'use client';

import Image from 'next/image';
import { ExternalLink, Github, ShieldCheck, X } from 'lucide-react';
import {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  Group,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import CredentialAuthForm from '@/components/CredentialAuthForm';
import {
  getMemorialStats,
  getMyMemorial,
  MemorialAward,
  MemorialStats,
  MemorialUnavailable,
} from '@/lib/memorial-api';
import { API_BASE_URL, ArenaApiError } from '@/lib/platform-api';

const REASON_COPY: Record<string, string> = {
  campaign_preparing: 'The Founding registry is being prepared. Return shortly.',
  founding_edition_full: 'All 402 Founding places have been assigned.',
  registration_pending: 'Your Arena registration is waiting to be recorded.',
  account_required: 'Sign in with GitHub or an invite-enabled Arena account to claim.',
  github_identity_required: 'Sign in with GitHub or an invite-enabled Arena account to claim.',
};

type ClaimState =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'award'; award: MemorialAward }
  | { kind: 'unavailable'; result: MemorialUnavailable }
  | { kind: 'error'; message: string };

function compactAddress(value: string): string {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export default function Founding402Claim() {
  const [stats, setStats] = useState<MemorialStats | null>(null);
  const [claim, setClaim] = useState<ClaimState>({ kind: 'loading' });
  const [showAwardModal, setShowAwardModal] = useState(false);
  const oauthHref = useMemo(
    () =>
      `${API_BASE_URL}/api/auth/github/start?${new URLSearchParams({
        return_to: '/founding402/claim',
      })}`,
    [],
  );

  const loadClaim = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await getMyMemorial(signal);
      setClaim(
        result.eligible
          ? { kind: 'award', award: result }
          : { kind: 'unavailable', result },
      );
    } catch (error: unknown) {
      if (error instanceof ArenaApiError && error.status === 401) {
        setClaim({ kind: 'signed-out' });
        return;
      }
      setClaim({
        kind: 'error',
        message:
          error instanceof ArenaApiError && error.status === 404
            ? 'The Founding registry is not open yet.'
            : 'The registry could not be reached. Try again shortly.',
      });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.allSettled([
      getMemorialStats(controller.signal).then(setStats),
      loadClaim(controller.signal),
    ]);
    return () => controller.abort();
  }, [loadClaim]);

  const shouldPoll =
    claim.kind === 'award' && claim.award.status !== 'minted';

  useEffect(() => {
    if (!shouldPoll) return;
    const controller = new AbortController();
    const interval = window.setInterval(() => {
      void Promise.allSettled([
        getMemorialStats(controller.signal).then(setStats),
        loadClaim(controller.signal),
      ]);
    }, 3_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [loadClaim, shouldPoll]);

  useEffect(() => {
    if (claim.kind !== 'award') return;
    const seenKey = `founding402-award-${claim.award.tokenId}`;
    if (window.sessionStorage.getItem(seenKey)) return;
    window.sessionStorage.setItem(seenKey, 'shown');
    setShowAwardModal(true);
  }, [claim]);

  return (
    <div className="founding-page">
      <section className="founding-hero">
        <div className="founding-copy">
          <p className="label">Genesis registry · Injective testnet</p>
          <h1 className="display founding-title">
            First <em>402</em>
          </h1>
          <p className="founding-lede">
            Link GitHub or create an invite-enabled Arena account. The first 402
            registrations receive a numbered, non-transferable memorial NFT and
            a dedicated testnet wallet—no MetaMask required.
          </p>
          <div className="founding-trust">
            <span>
              <ShieldCheck aria-hidden="true" />
              GitHub or invite identity
            </span>
            <span>Wallet credentials stay offline</span>
          </div>
        </div>

        <RegistryMatrix stats={stats} />
      </section>

      <section className="founding-claim" aria-labelledby="claim-heading">
        <header>
          <p className="label">Your founding record</p>
          <h2 className="display" id="claim-heading">
            Claim the mark.
          </h2>
        </header>
        <ClaimPanel
          claim={claim}
          oauthHref={oauthHref}
          onAuthenticated={() => {
            setClaim({ kind: 'loading' });
            return loadClaim();
          }}
        />
      </section>

      <section className="founding-rules" aria-label="Claim rules">
        <div>
          <span>Identity</span>
          <strong>One Arena account</strong>
          <p>Use GitHub or a valid invite. Repository access is never requested.</p>
        </div>
        <div>
          <span>Edition</span>
          <strong>Rank 001—402</strong>
          <p>Registration rank permanently determines the NFT token ID.</p>
        </div>
        <div>
          <span>Custody</span>
          <strong>Offline handoff</strong>
          <p>Seed phrases and private keys never enter this page or the API.</p>
        </div>
      </section>
      {showAwardModal && claim.kind === 'award' && (
        <AwardModal
          award={claim.award}
          onClose={() => setShowAwardModal(false)}
        />
      )}
    </div>
  );
}

function RegistryMatrix({ stats }: { stats: MemorialStats | null }) {
  const reserved = stats?.reserved ?? 0;
  const minted = stats?.minted ?? 0;
  const remaining = stats?.remaining;
  const displayCount = (value: number | undefined) =>
    value === undefined ? '—' : String(value).padStart(3, '0');

  return (
    <aside className="founding-registry" aria-label="Founding edition progress">
      <div className="founding-registry-head">
        <span>Edition ledger</span>
        <span>{stats ? displayCount(reserved) : '—'} / 402 locked</span>
      </div>
      <div className="founding-registry-feature">
        <InteractiveMemorialCoin />
        <dl className="founding-registry-counts">
          <div>
            <dt>Qualification locked</dt>
            <dd>{stats ? displayCount(reserved) : '—'}</dd>
          </div>
          <div>
            <dt>NFT confirmed</dt>
            <dd>{stats ? displayCount(minted) : '—'}</dd>
          </div>
          <div>
            <dt>Open places</dt>
            <dd>{displayCount(remaining)}</dd>
          </div>
        </dl>
      </div>
      <div className="founding-matrix" aria-hidden="true">
        {Array.from({ length: 402 }, (_, index) => (
          <i
            className={
              index < minted
                ? 'is-minted'
                : index < reserved
                  ? 'is-reserved'
                  : undefined
            }
            key={index}
          />
        ))}
      </div>
      <div className="founding-registry-foot">
        <span><i className="key-reserved" /> Qualification locked</span>
        <span><i className="key-minted" /> NFT confirmed</span>
      </div>
    </aside>
  );
}

type CoinMotion = {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  lastPointerX: number;
  lastPointerY: number;
  pressedAtX: number;
  pressedAtY: number;
  dragging: boolean;
  freeFrames: number;
};

type CoinThreeScene = {
  camera: PerspectiveCamera;
  group: Group;
  renderer: WebGLRenderer;
  scene: Scene;
};

const COIN_REST = {
  rotateX: -6,
  rotateY: 0,
  rotateZ: -4,
};

function InteractiveMemorialCoin() {
  const coinRef = useRef<HTMLButtonElement>(null);
  const discRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeSceneRef = useRef<CoinThreeScene | null>(null);
  const animationRef = useRef<number | null>(null);
  const motionRef = useRef<CoinMotion>({
    ...COIN_REST,
    velocityX: 0,
    velocityY: 0,
    velocityZ: 0,
    lastPointerX: 0,
    lastPointerY: 0,
    pressedAtX: 0,
    pressedAtY: 0,
    dragging: false,
    freeFrames: 0,
  });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [webglReady, setWebglReady] = useState(false);

  const renderCoin = useCallback(() => {
    const disc = discRef.current;
    if (!disc) return;
    const motion = motionRef.current;
    disc.style.setProperty('--coin-rotate-x', `${motion.rotateX}deg`);
    disc.style.setProperty('--coin-rotate-y', `${motion.rotateY}deg`);
    disc.style.setProperty('--coin-rotate-z', `${motion.rotateZ}deg`);

    const threeScene = threeSceneRef.current;
    if (!threeScene) return;
    const toRadians = Math.PI / 180;
    threeScene.group.rotation.set(
      motion.rotateX * toRadians,
      motion.rotateY * toRadians,
      motion.rotateZ * toRadians,
      'XYZ',
    );
    threeScene.renderer.render(threeScene.scene, threeScene.camera);
  }, []);

  const stopAnimation = useCallback(() => {
    if (animationRef.current === null) return;
    window.cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
  }, []);

  const settleCoin = useCallback(() => {
    stopAnimation();

    const tick = () => {
      const motion = motionRef.current;
      if (motion.dragging) {
        animationRef.current = null;
        return;
      }

      if (motion.freeFrames > 0) {
        motion.freeFrames -= 1;
        motion.velocityX *= 0.955;
        motion.velocityY *= 0.955;
        motion.velocityZ *= 0.94;
      } else {
        const targetY = Math.round(motion.rotateY / 360) * 360;
        motion.velocityX += (COIN_REST.rotateX - motion.rotateX) * 0.045;
        motion.velocityY += (targetY - motion.rotateY) * 0.028;
        motion.velocityZ += (COIN_REST.rotateZ - motion.rotateZ) * 0.045;
        motion.velocityX *= 0.82;
        motion.velocityY *= 0.84;
        motion.velocityZ *= 0.82;
      }

      motion.rotateX += motion.velocityX;
      motion.rotateY += motion.velocityY;
      motion.rotateZ += motion.velocityZ;
      renderCoin();

      const targetY = Math.round(motion.rotateY / 360) * 360;
      const settled =
        motion.freeFrames === 0 &&
        Math.abs(motion.rotateX - COIN_REST.rotateX) < 0.08 &&
        Math.abs(motion.rotateY - targetY) < 0.08 &&
        Math.abs(motion.rotateZ - COIN_REST.rotateZ) < 0.08 &&
        Math.abs(motion.velocityX) < 0.04 &&
        Math.abs(motion.velocityY) < 0.04 &&
        Math.abs(motion.velocityZ) < 0.04;

      if (settled) {
        motion.rotateX = COIN_REST.rotateX;
        motion.rotateY = targetY;
        motion.rotateZ = COIN_REST.rotateZ;
        motion.velocityX = 0;
        motion.velocityY = 0;
        motion.velocityZ = 0;
        renderCoin();
        animationRef.current = null;
        return;
      }

      animationRef.current = window.requestAnimationFrame(tick);
    };

    animationRef.current = window.requestAnimationFrame(tick);
  }, [renderCoin, stopAnimation]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener('change', updatePreference);
    renderCoin();
    return () => {
      media.removeEventListener('change', updatePreference);
      stopAnimation();
    };
  }, [renderCoin, stopAnimation]);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;
    const canvas: HTMLCanvasElement = canvasElement;

    let cancelled = false;
    let disposeScene: (() => void) | undefined;
    let pendingRenderer: WebGLRenderer | null = null;

    async function setupScene() {
      const THREE = await import('three');
      if (cancelled) return;

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas,
        powerPreference: 'high-performance',
      });
      pendingRenderer = renderer;
      renderer.setClearAlpha(0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.16;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(29, 1, 0.1, 20);
      camera.position.set(0, 0, 5.25);

      const texture = await new THREE.TextureLoader().loadAsync(
        '/assets/arena402-memorial-coin.png',
      );
      if (cancelled) {
        texture.dispose();
        renderer.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(
        4,
        renderer.capabilities.getMaxAnisotropy(),
      );

      const backTexture = texture.clone();
      backTexture.colorSpace = THREE.SRGBColorSpace;
      backTexture.wrapS = THREE.RepeatWrapping;
      backTexture.repeat.x = -1;
      backTexture.offset.x = 1;
      backTexture.needsUpdate = true;

      const edgeMaterial = new THREE.MeshPhysicalMaterial({
        clearcoat: 0.64,
        clearcoatRoughness: 0.2,
        color: 0xa87521,
        metalness: 0.96,
        roughness: 0.3,
      });
      const frontMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        metalness: 0.58,
        roughness: 0.42,
        transparent: true,
      });
      const backMaterial = new THREE.MeshStandardMaterial({
        map: backTexture,
        metalness: 0.58,
        roughness: 0.42,
        transparent: true,
      });

      const bodyGeometry = new THREE.CylinderGeometry(
        1,
        1,
        0.18,
        96,
        2,
        false,
      );
      bodyGeometry.rotateX(Math.PI / 2);
      const body = new THREE.Mesh(bodyGeometry, [
        edgeMaterial,
        frontMaterial,
        backMaterial,
      ]);
      body.rotation.z = Math.PI / 2;

      const rimGeometry = new THREE.TorusGeometry(0.91, 0.018, 10, 96);
      const frontRim = new THREE.Mesh(rimGeometry, edgeMaterial);
      frontRim.position.z = 0.096;
      const backRim = new THREE.Mesh(rimGeometry, edgeMaterial);
      backRim.position.z = -0.096;

      const group = new THREE.Group();
      group.add(body, frontRim, backRim);
      scene.add(group);

      const ambient = new THREE.HemisphereLight(0xf4f2ec, 0x1a1007, 1.45);
      const keyLight = new THREE.DirectionalLight(0xffdfa3, 3.8);
      keyLight.position.set(-3.2, 4.4, 5);
      const fillLight = new THREE.DirectionalLight(0xd8d7d2, 1.6);
      fillLight.position.set(3.4, -1.2, 3);
      const rimLight = new THREE.DirectionalLight(0xf4f2ec, 2.4);
      rimLight.position.set(2.2, 2.8, -4);
      scene.add(ambient, keyLight, fillLight, rimLight);

      const renderAtSize = () => {
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderCoin();
      };
      const resizeObserver = new ResizeObserver(renderAtSize);
      resizeObserver.observe(canvas);

      const handleContextLost = (event: Event) => {
        event.preventDefault();
        setWebglReady(false);
      };
      canvas.addEventListener('webglcontextlost', handleContextLost);

      threeSceneRef.current = { camera, group, renderer, scene };
      renderAtSize();
      setWebglReady(true);

      disposeScene = () => {
        resizeObserver.disconnect();
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        threeSceneRef.current = null;
        bodyGeometry.dispose();
        rimGeometry.dispose();
        edgeMaterial.dispose();
        frontMaterial.dispose();
        backMaterial.dispose();
        texture.dispose();
        backTexture.dispose();
        renderer.dispose();
      };
      pendingRenderer = null;
    }

    void setupScene().catch(() => {
      pendingRenderer?.dispose();
      pendingRenderer = null;
      setWebglReady(false);
    });

    return () => {
      cancelled = true;
      disposeScene?.();
    };
  }, [renderCoin]);

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (reducedMotion) return;
    stopAnimation();
    const motion = motionRef.current;
    motion.dragging = true;
    motion.lastPointerX = event.clientX;
    motion.lastPointerY = event.clientY;
    motion.pressedAtX = event.clientX;
    motion.pressedAtY = event.clientY;
    motion.velocityX = 0;
    motion.velocityY = 0;
    motion.velocityZ = 0;
    coinRef.current?.setPointerCapture(event.pointerId);
    coinRef.current?.setAttribute('data-dragging', '');
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (reducedMotion) return;
    const motion = motionRef.current;

    if (motion.dragging) {
      const deltaX = event.clientX - motion.lastPointerX;
      const deltaY = event.clientY - motion.lastPointerY;
      motion.lastPointerX = event.clientX;
      motion.lastPointerY = event.clientY;
      motion.rotateX -= deltaY * 0.72;
      motion.rotateY += deltaX * 1.08;
      motion.rotateZ += deltaX * 0.075;
      motion.velocityX = Math.max(-12, Math.min(12, -deltaY * 0.82));
      motion.velocityY = Math.max(-20, Math.min(20, deltaX * 1.26));
      motion.velocityZ = Math.max(-3, Math.min(3, deltaX * 0.09));
      renderCoin();
      return;
    }

    if (event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const normalizedX = (event.clientX - rect.left) / rect.width - 0.5;
    const normalizedY = (event.clientY - rect.top) / rect.height - 0.5;
    const nextX = COIN_REST.rotateX - normalizedY * 18;
    const nextY = normalizedX * 24;
    const nextZ = COIN_REST.rotateZ + normalizedX * 5;
    motion.velocityX = (nextX - motion.rotateX) * 0.24;
    motion.velocityY = (nextY - motion.rotateY) * 0.24;
    motion.velocityZ = (nextZ - motion.rotateZ) * 0.24;
    motion.rotateX = nextX;
    motion.rotateY = nextY;
    motion.rotateZ = nextZ;
    renderCoin();
  }

  function releaseCoin(event: ReactPointerEvent<HTMLButtonElement>) {
    if (reducedMotion) return;
    const motion = motionRef.current;
    if (!motion.dragging) return;
    const travel = Math.hypot(
      event.clientX - motion.pressedAtX,
      event.clientY - motion.pressedAtY,
    );
    motion.dragging = false;
    motion.freeFrames = travel < 5 ? 28 : 14;
    if (travel < 5) {
      motion.velocityX = -2.4;
      motion.velocityY = 17;
      motion.velocityZ = 0.6;
    }
    coinRef.current?.removeAttribute('data-dragging');
    if (coinRef.current?.hasPointerCapture(event.pointerId)) {
      coinRef.current.releasePointerCapture(event.pointerId);
    }
    settleCoin();
  }

  function handlePointerLeave() {
    if (reducedMotion || motionRef.current.dragging) return;
    motionRef.current.freeFrames = 0;
    settleCoin();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (reducedMotion || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    const motion = motionRef.current;
    stopAnimation();
    motion.velocityX = -2.8;
    motion.velocityY = event.shiftKey ? -18 : 18;
    motion.velocityZ = event.shiftKey ? -0.7 : 0.7;
    motion.freeFrames = 30;
    settleCoin();
  }

  return (
    <div className="founding-registry-coin-stage">
      <button
        ref={coinRef}
        className="founding-registry-coin"
        type="button"
        aria-label="Spin memorial coin"
        aria-disabled={reducedMotion}
        onKeyDown={handleKeyDown}
        onPointerCancel={releaseCoin}
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        onPointerUp={releaseCoin}
      >
        <span
          ref={discRef}
          className="founding-registry-coin-disc"
          data-webgl-ready={webglReady ? '' : undefined}
        >
          <canvas
            ref={canvasRef}
            className="founding-registry-coin-canvas"
            aria-hidden="true"
          />
          <Image
            className="founding-registry-coin-fallback"
            src="/assets/arena402-memorial-coin.png"
            width={250}
            height={250}
            priority
            draggable={false}
            sizes="(max-width: 620px) 132px, 176px"
            alt="Arena 402 gold pawn memorial coin"
          />
        </span>
      </button>
      <span className="founding-registry-coin-hint">Drag or flick coin</span>
    </div>
  );
}

function ClaimPanel({
  claim,
  oauthHref,
  onAuthenticated,
}: {
  claim: ClaimState;
  oauthHref: string;
  onAuthenticated: () => void | Promise<void>;
}) {
  if (claim.kind === 'loading') {
    return <div className="founding-panel founding-loading">Reading the registry…</div>;
  }
  if (claim.kind === 'signed-out') {
    return (
      <div className="founding-panel founding-auth">
        <p className="founding-panel-kicker">No identity linked</p>
        <h3>Enter the registry.</h3>
        <p>
          Choose GitHub, or use an invite code to register and sign in directly
          with your Arena account.
        </p>
        <IdentityAuthOptions
          oauthHref={oauthHref}
          onAuthenticated={onAuthenticated}
        />
      </div>
    );
  }
  if (claim.kind === 'unavailable') {
    return (
      <div className="founding-panel">
        <p className="founding-panel-kicker">Registry response</p>
        <h3>Not assigned yet.</h3>
        <p>{REASON_COPY[claim.result.reason] || 'No Founding record is available.'}</p>
        {(claim.result.reason === 'account_required' ||
          claim.result.reason === 'github_identity_required') && (
          <IdentityAuthOptions
            oauthHref={oauthHref}
            onAuthenticated={onAuthenticated}
          />
        )}
      </div>
    );
  }
  if (claim.kind === 'error') {
    return (
      <div className="founding-panel founding-error" role="alert">
        <p className="founding-panel-kicker">Registry unavailable</p>
        <h3>Claiming is paused.</h3>
        <p>{claim.message}</p>
      </div>
    );
  }

  const { award } = claim;
  const minted = award.status === 'minted';
  const submitted = award.status === 'submitted';
  return (
    <div className="founding-panel founding-award">
      <div className="founding-award-serial">
        <span>Founding rank</span>
        <strong>#{String(award.registrationRank).padStart(3, '0')}</strong>
        <small>of {award.editionSize}</small>
      </div>
      <dl>
        <div><dt>Token ID</dt><dd>{award.tokenId}</dd></div>
        <div><dt>Wallet</dt><dd title={award.walletAddress}>{compactAddress(award.walletAddress)}</dd></div>
        <div><dt>Qualification</dt><dd>Locked</dd></div>
        <div>
          <dt>NFT status</dt>
          <dd>
            {minted
              ? 'Mint confirmed'
              : submitted
                ? 'Confirming on-chain'
                : 'Queued for mint'}
          </dd>
        </div>
      </dl>
      <p className="founding-status-copy">
        {minted
          ? 'Your testnet memorial NFT is confirmed on-chain.'
          : submitted
            ? 'Your mint transaction is live. This record refreshes automatically.'
            : 'Your place and wallet are secured. Minting will begin automatically.'}
      </p>
      {award.tokenUrl && (
        <a
          className="founding-explorer"
          href={award.tokenUrl}
          target="_blank"
          rel="noreferrer"
        >
          View on Blockscout
          <ExternalLink aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

function IdentityAuthOptions({
  oauthHref,
  onAuthenticated,
}: {
  oauthHref: string;
  onAuthenticated: () => void | Promise<void>;
}) {
  return (
    <div className="founding-auth-options">
      <div className="founding-auth-option">
        <p className="founding-auth-option-label">01 · GitHub</p>
        <h4>Continue with GitHub</h4>
        <p>Authorize the identity you already use in Arena.</p>
        <a className="btn founding-github" href={oauthHref}>
          <Github aria-hidden="true" />
          Continue with GitHub
        </a>
      </div>
      <div className="founding-auth-option">
        <p className="founding-auth-option-label">02 · Invite code</p>
        <h4>Use an Arena account</h4>
        <p>Register with your one-time invite code, or sign in below.</p>
        <CredentialAuthForm
          initialMode="register"
          onAuthenticated={onAuthenticated}
          returnTo="/founding402/claim"
        />
      </div>
    </div>
  );
}

function AwardModal({
  award,
  onClose,
}: {
  award: MemorialAward;
  onClose: () => void;
}) {
  const minted = award.status === 'minted';
  const submitted = award.status === 'submitted';
  return (
    <div
      className="founding-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="founding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="founding-modal-title"
      >
        <button
          className="founding-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close Founding record"
        >
          <X aria-hidden="true" />
        </button>
        <p className="label">Arena 402 · Genesis registry</p>
        <div className="founding-coin">
          <Image
            src="/assets/arena402-memorial-coin.png"
            width={250}
            height={250}
            priority
            alt="Arena 402 gold pawn memorial coin"
          />
        </div>
        <p className="founding-modal-rank">
          Founding #{String(award.registrationRank).padStart(3, '0')}
        </p>
        <h2 className="display" id="founding-modal-title">
          {minted ? 'Memorial minted.' : 'Your place is secured.'}
        </h2>
        <p className="founding-modal-copy">
          {minted
            ? `Token ${award.tokenId} is confirmed in your dedicated Arena wallet.`
            : submitted
              ? `Token ${award.tokenId} is being confirmed on Injective testnet.`
              : `Token ${award.tokenId} is queued for immediate testnet minting.`}
        </p>
        <div className="founding-modal-status" aria-live="polite">
          <i className={minted ? 'is-confirmed' : submitted ? 'is-live' : undefined} />
          {minted
            ? 'NFT confirmed'
            : submitted
              ? 'Transaction submitted'
              : 'Qualification locked'}
        </div>
        <button className="btn founding-modal-action" type="button" onClick={onClose}>
          View my record
        </button>
      </section>
    </div>
  );
}
