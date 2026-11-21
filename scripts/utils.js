import {MODULE_ID} from "./constants.js";

export function getTargetedTokens() {
    // Always a Set: both callers use .has() on the result, and Foundry's Set#map
    // returns a Set, so the fallback has to match rather than being an array.
    return new Set(Array.from(globalThis.game?.user?.targets ?? [], token => token.id));
}

export function getControlledTokens() {
    return globalThis.canvas?.tokens?.controlled ?? globalThis.game?.canvas?.tokens?.controlled ?? [];
}

export function capitalizeFirstLetter(string) {
    return string ? string[0].toUpperCase() + string.slice(1) : '';
}

export function generateDiamonds(count) {
    const total = 6;
    const full = '◆';
    const empty = '◇';

    // Clamped rather than thrown. Nothing catches exceptions between here and Core's
    // buildActionsCore, so a single out-of-range value used to take down the whole
    // HUD, and the system's schema puts no maximum on skill or proficiency values.
    const filled = Math.min(total, Math.max(0, Math.round(Number(count) || 0)));

    return full.repeat(filled) + empty.repeat(total - filled);
}

export function getSetting(label) {
    return game.settings.get(MODULE_ID, label)
}

export function getActiveStatusIds(actor) {
    return Array.from(actor?.effects ?? [])
        .filter(effect => !effect.disabled && !effect.isSuppressed)
        .flatMap(effect => [...(effect?.statuses ?? [])])
        .filter(Boolean);
}

export function isAllowedForUser(label) {
    // Loremasters always see everything; the world setting only gates players.
    return game.user.isGM || getSetting(label);
}

export function getCurrentCommunity() {
    // Delegates to the system so the "current community" setting stays a single
    // source of truth; the type guard covers the setting pointing at a stale id.
    const community = game.tor2e?.macro?.utility?.getCommunity?.();
    return community?.type === 'community' ? community : null;
}

export function getImage(entity, defaultImages = []) {
    let result = "";
    if (game.settings.get("token-action-hud-core", "displayIcons")) {
        result = (typeof entity === "string")
            ? entity
            : entity?.img ?? entity?.icon ?? "";
    }
    return ![...defaultImages, "icons/svg/mystery-man.svg"].includes(result) ? result : "";
}
