/**
 * Central configuration for the crane game.
 *
 * Every physics-relevant number lives here so it can be tuned in one place and
 * surfaced through the debug panel. Components must never hard-code physical
 * quantities (friction, mass, speeds, sizes ...). See spec sections 19 & 32.
 *
 * Units: meters, kilograms, seconds, radians. World is a "human sized" space
 * roughly 4m wide, so `lengthUnit` stays at the Rapier default of 1.
 *
 * Coordinate system (spec section 4): +X = right, +Y = up, +Z = depth.
 *
 * Spec §4 labels +Z as "奥" (far). To keep a conventional right-handed Three.js
 * setup where the play camera sits in front and +X reads as screen-right
 * (spec §22), this implementation puts the camera on the +Z side and treats
 * *decreasing* Z as "moving deeper into the cabinet". The crane's home / chute
 * is at large Z (near the player); pressing the 奥 button lowers Z toward
 * `crane.minZ`. All spec config field names are kept unchanged.
 */

export type Vec3 = readonly [number, number, number];

export interface GameConfig {
  gravity: number;

  physics: {
    /** Fixed physics timestep (seconds). Decouples sim from render FPS. */
    timeStep: number;
    /** Constraint solver iterations. Higher = stiffer, more stable grip. */
    numSolverIterations: number;
    /** Internal PGS iterations per solver iteration. */
    numInternalPgsIterations: number;
    /** Enable continuous collision detection on fast/thin bodies. */
    ccd: boolean;
  };

  crane: {
    /** Horizontal travel speed while the "right" button is held (m/s). */
    xSpeed: number;
    /** Depth travel speed while the "back" button is held (m/s). */
    zSpeed: number;
    /** Vertical descent speed of the claw assembly (m/s). */
    descentSpeed: number;
    /** Vertical lift speed of the claw assembly (m/s). */
    liftSpeed: number;
    /** Return-to-home horizontal speed (m/s). */
    returnSpeed: number;

    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;

    /** Home / rest position of the claw hub (also the drop point over the chute). */
    homeX: number;
    homeY: number;
    homeZ: number;

    /** Fixed Y of the trolley/carriage that the cable hangs from. */
    carriageY: number;
    /** Target Y of the claw hub when fully raised (shortest cable). */
    topY: number;
    /** Target Y of the claw hub at the bottom of a descent (longest cable). */
    lowestY: number;

    /**
     * Nominal weight the cable holds while the claw hangs (kg-equivalent, used
     * for the tension readout / descent-stop). Not a physical body mass — the
     * hub is kinematic.
     */
    hubMass: number;
    /**
     * While lowering, the descent stops once the cable tension (N) drops below
     * this — i.e. the cable has gone slack because the claw is resting on the
     * prize / rods (spec §15). 0 stops only when the cable would start to push.
     */
    descentTensionStop: number;

    /** Seconds to hold still after the claws close, before lifting. */
    settleTime: number;
    /** Seconds to wait in the release pose before resetting to idle. */
    releaseTime: number;
    /** Seconds the claws take to reach the fully open pose before descending. */
    openTime: number;
  };

  claw: {
    /** Number of prongs. The rig is built for 2. */
    count: number;
    /** Motor-driven open angle (rad), magnitude — the fixed open pose. */
    openAngle: number;
    /** Rest (spring) target angle (rad), magnitude — the closed / squeeze pose. */
    closedAngle: number;
    /**
     * Hard limits on how far a prong can swing, as magnitudes (rad). The
     * revolute joint physically cannot open past `limitOpen` or close past
     * `limitClose`, so an object sliding along the prong can't force it wider
     * than intended.
     */
    limitOpen: number;
    limitClose: number;

    /**
     * Spring that holds each prong closed. `motorStiffness` is the elastic
     * constant ("Arm Power"): the residual force when a prize wedges the
     * prongs open is `motorStiffness × angleError`, i.e. the grip strength.
     * Closing is *only* this spring — no active drive (spec §9).
     */
    motorStiffness: number;
    motorDamping: number;
    /** Fixed strong motor used only to push the prongs to `openAngle`. */
    openStiffness: number;
    openDamping: number;
    /** Reserved tuning knob (spec §9); no direct setMotorMaxForce in the JS API. */
    motorMaxImpulse: number;

    friction: number;
    restitution: number;

    /**
     * Each prong is a flat two-segment dogleg (UFO-catcher style): an upper
     * segment from the pivot, a bend, then a lower segment to a small grip tip.
     */
    /** Upper segment length. */
    armLength: number;
    /** Lower segment length. */
    lowerLength: number;
    /** Outward lean of the upper segment (rad). */
    upperTilt: number;
    /** Bend between the two segments (rad); the lower segment turns inward. */
    bendAngle: number;
    /** Grip-tip length. */
    gripLength: number;
    /** Grip-tip thickness (its X cross-section); adjustable on the ARM panel. */
    gripThickness: number;
    /** Bar cross-section: thickness (X) and depth (Z). */
    armThickness: number;
    armDepth: number;
    /** Distance between the two pivots on the hub, along X. */
    pivotSpan: number;
    /** Mass of a single claw prong. */
    mass: number;
    /** Linear / angular damping on the claw bodies (kills jitter). */
    linearDamping: number;
    angularDamping: number;
  };

  prize: {
    width: number;
    height: number;
    depth: number;

    mass: number;
    friction: number;
    restitution: number;

    linearDamping: number;
    angularDamping: number;

    /** Center of mass offset from the geometric center. */
    centerOfMass: Vec3;

    position: Vec3;
    rotation: Vec3;
  };

  bridge: {
    rodRadius: number;
    /** Number of parallel rods. */
    rodCount: number;
    /** Rod length along X (wall to wall). */
    rodLength: number;
    /** Center-to-center spacing between adjacent rods, along Z. */
    rodSpacing: number;
    /** Center Y of the rods. */
    rodHeight: number;
    /** Center Z of the rod array. */
    rodCenterZ: number;
    friction: number;
    restitution: number;
  };

  floor: {
    y: number;
    friction: number;
    restitution: number;
    /** World extents of the floor: [minX, maxX, minZ, maxZ]. */
    bounds: readonly [number, number, number, number];
  };

  /**
   * Goal volume the prize must enter to count as collected (spec §27). Here it
   * is a thin slab covering the whole cabinet floor: any prize that ends up on
   * the floor (knocked off the bridge or dropped) counts.
   */
  goal: {
    center: Vec3;
    /** Half-extents of the goal box. */
    halfExtents: Vec3;
  };

  camera: {
    position: Vec3;
    target: Vec3;
    fov: number;
  };
}

export const gameConfig: GameConfig = {
  gravity: -9.81,

  physics: {
    timeStep: 1 / 60,
    numSolverIterations: 14,
    numInternalPgsIterations: 3,
    ccd: true,
  },

  crane: {
    xSpeed: 1.3,
    zSpeed: 1.1,
    descentSpeed: 0.5,
    liftSpeed: 0.55,
    returnSpeed: 0.9,

    minX: -1.35,
    maxX: 1.0,
    // "Deeper into the cabinet" is toward smaller Z. minZ is the deepest the
    // crane can travel; maxZ is the home / front edge.
    minZ: -0.9,
    maxZ: 1.1,

    homeX: -1.35,
    homeY: 3.0,
    homeZ: 1.1,

    carriageY: 3.55,
    topY: 3.0,
    lowestY: 1.66,

    hubMass: 0.9,
    descentTensionStop: 9,

    settleTime: 0.8,
    releaseTime: 0.7,
    openTime: 0.35,
  },

  claw: {
    count: 2,
    openAngle: 0.36,
    closedAngle: 0.02,
    limitOpen: 0.62,
    limitClose: 0.55,

    motorStiffness: 32,
    motorDamping: 4,
    // Soft enough that a firm push from the prize can force the prongs open
    // past `openAngle` — up to `limitOpen` if friction lets them slide.
    openStiffness: 60,
    openDamping: 6,
    motorMaxImpulse: 12,

    friction: 3.0,
    restitution: 0.0,

    armLength: 0.42,
    lowerLength: 0.4,
    upperTilt: 0.12,
    bendAngle: 0.78,
    gripLength: 0.09,
    gripThickness: 0.028,
    armThickness: 0.05,
    armDepth: 0.12,
    pivotSpan: 0.58,
    mass: 0.3,
    linearDamping: 0.4,
    angularDamping: 0.8,
  },

  prize: {
    width: 0.3,
    height: 0.58,
    depth: 0.3,

    mass: 0.34,
    friction: 1.3,
    restitution: 0.02,

    linearDamping: 0.35,
    angularDamping: 0.55,

    centerOfMass: [0, 0, 0],

    position: [0.15, 1.45, -0.1],
    rotation: [0, 0, 0],
  },

  bridge: {
    rodRadius: 0.045,
    rodCount: 4,
    // Wall-to-wall: floor.bounds X span (4.0) minus the wall thickness.
    rodLength: 3.9,
    rodSpacing: 0.24,
    rodHeight: 1.05,
    rodCenterZ: -0.1,
    friction: 0.5,
    restitution: 0.0,
  },

  floor: {
    y: 0,
    friction: 0.7,
    restitution: 0.0,
    bounds: [-2.0, 2.0, -2.0, 2.0],
  },

  // Thin slab just above the whole floor: collected once the prize is low
  // enough to be resting on the floor (well below the bridge at y≈1.38).
  goal: {
    center: [0, 0.2, 0],
    halfExtents: [1.95, 0.42, 1.95],
  },

  camera: {
    // Head-on with the cabinet (X aligned to its centre), looking slightly down.
    position: [0, 3.5, 8.6],
    target: [0, 1.55, 0.0],
    fov: 44,
  },
};
