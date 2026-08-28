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

    /** Y of the claw hub when fully raised. */
    topY: number;
    /** Y of the claw hub at the bottom of a descent. */
    lowestY: number;

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
    /** Motor target angle (rad) for the open pose, magnitude. */
    openAngle: number;
    /** Motor target angle (rad) for the closed pose, magnitude (squeeze). */
    closedAngle: number;

    /** Position motor stiffness (spring constant). Limits closing force. */
    motorStiffness: number;
    /** Position motor damping. */
    motorDamping: number;
    /**
     * Nominal "max impulse" budget for the closing motor. Rapier's JS binding
     * has no setMotorMaxForce, so this is applied by clamping stiffness; it is
     * kept as an explicit tuning knob (spec section 9).
     */
    motorMaxImpulse: number;

    friction: number;
    restitution: number;

    /** Length of the main arm segment. */
    armLength: number;
    /** Square cross-section side of the arm. */
    armThickness: number;
    /** Length of the angled tip segment. */
    tipLength: number;
    /** Inward tilt of the tip segment (rad). */
    tipAngle: number;
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
    rodLength: number;
    /** Center-to-center distance between the two rods, along X. */
    rodGap: number;
    /** Center Y of the rods. */
    rodHeight: number;
    /** Center X of the rod pair. */
    rodCenterX: number;
    /** Center Z of the rod pair. */
    rodCenterZ: number;
    friction: number;
    restitution: number;
  };

  floor: {
    y: number;
    friction: number;
    restitution: number;
    /** AABB of the open chute in the floor: [minX, maxX, minZ, maxZ]. */
    chute: readonly [number, number, number, number];
    /** World extents of the floor: [minX, maxX, minZ, maxZ]. */
    bounds: readonly [number, number, number, number];
  };

  /** Goal volume the prize must enter to count as collected (spec section 27). */
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
    numSolverIterations: 8,
    numInternalPgsIterations: 2,
    ccd: true,
  },

  crane: {
    xSpeed: 1.3,
    zSpeed: 1.1,
    descentSpeed: 0.6,
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

    topY: 3.0,
    lowestY: 1.66,

    settleTime: 0.8,
    releaseTime: 0.7,
    openTime: 0.5,
  },

  claw: {
    count: 2,
    openAngle: 0.3,
    closedAngle: 0.66,

    motorStiffness: 420,
    motorDamping: 42,
    motorMaxImpulse: 12,

    friction: 3.0,
    restitution: 0.0,

    armLength: 0.72,
    armThickness: 0.06,
    tipLength: 0.3,
    tipAngle: 0.85,
    pivotSpan: 0.48,
    mass: 0.32,
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
    rodRadius: 0.05,
    rodLength: 2.2,
    rodGap: 0.3,
    rodHeight: 1.05,
    rodCenterX: 0.15,
    rodCenterZ: -0.1,
    friction: 0.5,
    restitution: 0.0,
  },

  floor: {
    y: 0,
    friction: 0.7,
    restitution: 0.0,
    // Chute occupies the front-left corner (large Z, small X).
    chute: [-2.0, -0.9, 0.5, 2.0],
    bounds: [-2.0, 2.0, -2.0, 2.0],
  },

  goal: {
    center: [-1.35, 0.35, 1.1],
    halfExtents: [0.5, 0.8, 0.65],
  },

  camera: {
    position: [3.3, 3.15, 6.9],
    target: [-0.15, 1.4, 0.0],
    fov: 46,
  },
};
