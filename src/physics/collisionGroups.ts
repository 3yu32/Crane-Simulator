/**
 * Collision filtering (spec §10, §30).
 *
 * The crane hub and the claw prongs are connected by joints and overlap in
 * space, so they must not collide with each other — otherwise the contact
 * solver fights the joint motors and the prongs can never move. They still need
 * to collide with the prize, rods and floor.
 *
 * Rapier rule: colliders A and B collide iff
 *   (A.memberships & B.filter) != 0  &&  (B.memberships & A.filter) != 0
 *
 * World bodies (prize, rods, cabinet) keep Rapier's default "collide with
 * everything" groups, so only the crane and claws need explicit groups here.
 */

import { interactionGroups } from "@react-three/rapier";

const GROUP_CRANE = 0;
const GROUP_CLAW = 1;
const GROUP_WORLD = 2;

/** Crane body: collides with the world only (not with the claws). */
export const CRANE_GROUPS = interactionGroups([GROUP_CRANE], [GROUP_WORLD]);

/**
 * Claw bodies: collide with the world only — not the crane, and not each other.
 * The two long dogleg prongs overlap near the centre when closed; letting them
 * collide just jams them together and starves the prong motors.
 */
export const CLAW_GROUPS = interactionGroups([GROUP_CLAW], [GROUP_WORLD]);
