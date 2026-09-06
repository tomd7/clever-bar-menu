import { Flashlight, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { ActionButton } from '#/components/buttons/action-button'
import { IconButton } from '#/components/buttons/icon-button'
import { ScannerUnavailableError, createScanner } from '#/features/menu/scanner'

/** Espacement entre deux tentatives de lecture. */
const DETECT_INTERVAL_MS = 150

/**
 * La caméra et sa boucle de lecture.
 *
 * Séparée de l'écran parce qu'elle ne partage rien avec lui : elle ne connaît
 * ni les produits, ni le stock, ni ce qu'un code veut dire. Elle ouvre un flux,
 * en tire des codes-barres, et les remonte. Tout le reste — résoudre, écrire,
 * corriger — vit dans `ScanPage`.
 *
 * Ce composant a une particularité qui explique la moitié de son code : il
 * tient une ressource matérielle. Une caméra laissée ouverte, c'est un voyant
 * allumé sur le téléphone d'un gérant qui a quitté l'écran, et une batterie qui
 * descend. Le flux est donc coupé au démontage, y compris celui qui se résout
 * *après* le démontage, et l'onglet mis en arrière-plan suspend la lecture.
 */
export function ScanCamera({
  paused,
  onDetect,
}: {
  /** La lecture est suspendue tant qu'un panneau est ouvert par-dessus. */
  paused: boolean
  onDetect: (barcode: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'starting' | 'ready' | 'error'>(
    'starting',
  )
  const [message, setMessage] = useState('')
  const [torch, setTorch] = useState<boolean | null>(null)
  const [attempt, setAttempt] = useState(0)

  /*
    `paused` et `onDetect` passent par des refs plutôt que par les dépendances
    de l'effet. Les mettre en dépendances rejouerait l'effet à chaque ouverture
    de panneau — donc couperait le flux et redemanderait la permission, ce qui
    est exactement ce qu'un scan enchaîné ne peut pas se permettre. La boucle,
    elle, doit lire la valeur du moment et non celle qu'elle a capturée à sa
    création.
  */
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  const onDetectRef = useRef(onDetect)
  onDetectRef.current = onDetect

  const trackRef = useRef<MediaStreamTrack | null>(null)

  useEffect(() => {
    /*
      L'arrêt passe par un `AbortController` lu à travers un appel, et les deux
      moitiés comptent. Un booléen local serait tenu pour immuable à travers un
      `await` par l'analyse de flux — la boucle serait réputée infinie ; et lire
      `signal.aborted` directement ne suffit pas non plus, puisque les gardes
      ci-dessous rétrécissent la propriété à `false` pour tout ce qui suit. Un
      appel, lui, est réévalué à chaque tour, ce qui est la sémantique voulue.
    */
    const abort = new AbortController()
    const cancelled = () => abort.signal.aborted
    let stream: MediaStream | null = null

    /*
      Le dernier code retenu. Après validation, la bouteille est encore devant
      l'objectif : sans cette mémoire, elle repartirait aussitôt pour un
      deuxième mouvement. Un délai fixe aurait mal répondu — trop court il
      redéclenche, trop long il empêche de scanner la bouteille suivante. On
      attend donc que le code *disparaisse* de l'image, ce qui est le geste
      réel : on retire la bouteille du cadre.
    */
    let lastAccepted: string | null = null

    async function start() {
      let scanner
      try {
        scanner = await createScanner()
      } catch (error) {
        if (cancelled()) return
        setStatus('error')
        setMessage(
          error instanceof ScannerUnavailableError
            ? error.message
            : 'Lecture de code-barres indisponible sur ce navigateur.',
        )
        return
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            /*
              Un code-barres se lit à dix centimètres, sur une surface courbe :
              sans mise au point continue, l'image reste nette sur le fond de la
              pièce. La contrainte est facultative — elle est ignorée là où elle
              n'existe pas plutôt que de faire échouer l'ouverture.
            */
            focusMode: 'continuous',
          },
        })
      } catch (error) {
        if (cancelled()) return
        setStatus('error')
        setMessage(describeCameraError(error))
        return
      }

      /*
        Le flux peut arriver après que l'écran a été quitté : la promesse était
        déjà en vol. Sans cette coupure, la caméra reste allumée sur un
        composant qui n'existe plus.
      */
      if (cancelled()) {
        stopStream(stream)
        return
      }

      const video = videoRef.current
      if (!video) {
        stopStream(stream)
        return
      }

      video.srcObject = stream
      try {
        await video.play()
      } catch {
        /* Interrompue par un démontage : la boucle s'arrêtera d'elle-même. */
      }

      const [track] = stream.getVideoTracks()
      trackRef.current = track
      setTorch(hasTorch(track) ? false : null)
      setStatus('ready')

      while (!cancelled()) {
        if (!pausedRef.current && video.readyState >= video.HAVE_CURRENT_DATA) {
          const barcode = await scanner.detect(video)

          if (barcode === null || barcode !== lastAccepted) {
            lastAccepted = null
          }

          if (barcode !== null && lastAccepted === null) {
            lastAccepted = barcode
            /* Un retour au doigt, quand l'appareil sait le donner. */
            vibrate(30)
            onDetectRef.current(barcode)
          }
        }

        /*
          Le délai est posé **après** la lecture, jamais par un `setInterval` :
          sur un téléphone d'entrée de gamme un décodage peut dépasser
          l'intervalle, et les tentatives s'empileraient jusqu'à saturer
          l'appareil.
        */
        await sleep(DETECT_INTERVAL_MS)
      }
    }

    void start()

    return () => {
      abort.abort()
      trackRef.current = null
      if (stream) stopStream(stream)
    }
  }, [attempt])

  /*
    L'onglet en arrière-plan suspend la lecture sans couper le flux : décoder
    des images que personne ne regarde ne sert qu'à chauffer le téléphone, mais
    reprendre la caméra à chaque retour redemanderait la permission.
  */
  useEffect(() => {
    function onVisibility() {
      pausedRef.current = document.hidden || paused
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [paused])

  useWakeLock(status === 'ready')

  if (status === 'error') {
    return (
      <div className="panel rounded-2xl p-4 sm:p-5">
        <p role="alert" className="text-sm text-ink-soft">
          {message}
        </p>
        <ActionButton
          icon={RotateCcw}
          variant="outline"
          className="mt-3"
          onClick={() => {
            setStatus('starting')
            setAttempt((value) => value + 1)
          }}
        >
          Réessayer
        </ActionButton>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-board">
      <video
        ref={videoRef}
        /*
          Les trois attributs sont nécessaires, et pas seulement sur iOS :
          `playsInline` évite le passage en plein écran natif, `muted` autorise
          la lecture automatique, et l'un sans l'autre laisse une image figée.
        */
        playsInline
        muted
        autoPlay
        className="aspect-[3/4] w-full object-cover sm:aspect-[4/3]"
      />

      {/*
        La visée : une fenêtre claire au milieu d'un voile, pas un cadre posé
        sur l'image. C'est le voile qui dit où viser — un rectangle en trait
        fin se confond avec le décor d'une étagère.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-28 w-4/5 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] ring-1 ring-white/70" />
      </div>

      {status === 'starting' ? (
        <p className="absolute inset-x-0 bottom-4 text-center text-sm text-on-board-soft">
          Ouverture de la caméra…
        </p>
      ) : null}

      {torch !== null ? (
        <div className="absolute top-2 right-2">
          <IconButton
            icon={Flashlight}
            label={torch ? 'Éteindre la lampe' : 'Allumer la lampe'}
            aria-pressed={torch}
            className={
              torch
                ? 'bg-white/90 text-ink hover:bg-white'
                : 'bg-black/40 text-white hover:bg-black/60 hover:text-white'
            }
            onClick={() => {
              const next = !torch
              setTorch(next)
              void applyTorch(trackRef.current, next)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

/**
 * Garde l'écran allumé pendant une session de scan.
 *
 * Ranger une livraison prend plusieurs minutes, pendant lesquelles on regarde
 * les bouteilles et pas le téléphone : sans cela l'écran s'éteint toutes les
 * trente secondes et la caméra est à rallumer à chaque casier. Le verrou est
 * perdu dès que l'onglet passe en arrière-plan — c'est le navigateur qui le
 * reprend — d'où la reprise sur `visibilitychange`.
 */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return

    let sentinel: WakeLockSentinel | null = null
    let released = false

    async function acquire() {
      try {
        const lock = await wakeLock()?.request('screen')
        if (released) void lock?.release()
        else sentinel = lock ?? null
      } catch {
        /* Refusé ou indisponible : l'écran s'éteindra, rien de plus. */
      }
    }

    function onVisibility() {
      if (!document.hidden && !released) void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel?.release()
    }
  }, [active])
}

/**
 * Traduit un refus de `getUserMedia`.
 *
 * Les quatre causes appellent quatre phrases différentes, et la distinction
 * n'est pas cosmétique : sur une permission déjà refusée, le navigateur ne
 * redemandera rien — proposer « Réessayer » sans dire d'aller dans les réglages
 * enverrait le gérant appuyer indéfiniment sur un bouton sans effet.
 */
function describeCameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Accès à la caméra refusé. Autorisez-le dans les réglages du navigateur, puis rouvrez cet écran.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return "Aucune caméra arrière n'a été trouvée sur cet appareil."
    case 'NotReadableError':
      return 'La caméra est utilisée par une autre application. Fermez-la, puis réessayez.'
    default:
      return "La caméra n'a pas pu être ouverte. Saisissez le code à la main."
  }
}

function stopStream(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop()
}

/*
  `torch` et `focusMode` existent dans les navigateurs mobiles mais pas dans
  `lib.dom` : ce sont des contraintes de l'extension « image capture », restées
  hors du cœur de la spécification. On complète les interfaces plutôt que de
  forcer par un cast — un cast dirait « fais-moi confiance », alors qu'ici on
  décrit une API qui existe bel et bien, et l'augmentation garde la vérification
  de type sur ce qu'on lui passe.
*/
declare global {
  interface MediaTrackConstraintSet {
    torch?: ConstrainBoolean
    focusMode?: ConstrainDOMString
  }

  interface MediaTrackCapabilities {
    torch?: boolean
  }
}

function hasTorch(track: MediaStreamTrack): boolean {
  return track.getCapabilities().torch === true
}

/*
  Deux APIs que `lib.dom` déclare obligatoires sur `Navigator` alors qu'elles
  manquent là où cet écran est le plus attendu : `vibrate` n'existe pas sur iOS,
  `wakeLock` pas davantage sur les navigateurs anciens. Les lire à travers un
  type structurel plus étroit rétablit l'optionalité que la réalité impose, sans
  cast et sans mentir au reste du fichier.
*/
function vibrate(ms: number) {
  const api: { vibrate?: (pattern: number) => boolean } = navigator
  api.vibrate?.(ms)
}

function wakeLock() {
  const api: {
    wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> }
  } = navigator

  return api.wakeLock
}

async function applyTorch(track: MediaStreamTrack | null, on: boolean) {
  try {
    await track?.applyConstraints({ advanced: [{ torch: on }] })
  } catch {
    /* La lampe n'a pas suivi : l'image reste lisible, ce n'est pas une panne. */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
