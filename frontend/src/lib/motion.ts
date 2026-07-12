import { useReducedMotion, type Variants, type Transition } from 'framer-motion';

type Bezier = [number, number, number, number];

/**
 * Shared, feature-agnostic framer-motion variants. Feature-specific motion
 * (commit graph, hash reveal, staging columns) is defined later in its own
 * feature module — nothing of that kind belongs here.
 */

const EASE: Bezier = [0.16, 1, 0.3, 1];

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: EASE } },
};

export const slideIn: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.24, ease: EASE } },
  exit: { opacity: 0, x: -8, transition: { duration: 0.16, ease: EASE } },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE } },
  exit: { opacity: 0, y: 8, transition: { duration: 0.16, ease: EASE } },
};

export const collapse: Variants = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: 'auto', transition: { duration: 0.24, ease: EASE } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.18, ease: EASE } },
};

export const staggerChildren: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

/** Every reusable variant, keyed for the reduced-motion flattener. */
const ALL_VARIANTS = {
  fadeIn,
  slideIn,
  slideUp,
  collapse,
  staggerChildren,
} as const;

export type VariantName = keyof typeof ALL_VARIANTS;

/**
 * Strip motion from a variant set: keep the final visual state of each named
 * state but drop transforms/opacity deltas and zero out transitions, so the
 * element snaps instantly to its resting appearance.
 */
function flatten(variants: Variants): Variants {
  const instant: Transition = { duration: 0 };
  const out: Variants = {};
  for (const [state, def] of Object.entries(variants)) {
    if (def && typeof def === 'object' && !Array.isArray(def)) {
      const { transition: _t, x: _x, y: _y, height: _h, ...rest } = def as Record<string, unknown>;
      out[state] = { ...rest, opacity: 1, transition: instant };
    } else {
      out[state] = def;
    }
  }
  return out;
}

/**
 * Reduced-motion-aware accessor for a shared variant. Returns instant/no-op
 * variants when the user prefers reduced motion, the real variants otherwise.
 * Call from inside a component (uses a hook).
 */
export function useMotionVariant(name: VariantName): Variants {
  const reduced = useReducedMotion();
  const base = ALL_VARIANTS[name];
  return reduced ? flatten(base) : base;
}

/** Same as {@link useMotionVariant} but returns the whole set at once. */
export function useMotionVariants(): Record<VariantName, Variants> {
  const reduced = useReducedMotion();
  if (!reduced) return { ...ALL_VARIANTS };
  return {
    fadeIn: flatten(fadeIn),
    slideIn: flatten(slideIn),
    slideUp: flatten(slideUp),
    collapse: flatten(collapse),
    staggerChildren: flatten(staggerChildren),
  };
}
