import {MODULE_ID} from "./constants.js";

export function getTargetedTokens() {
    if (!game || !game.user || !game.user.targets) {
        return [];
    }
    return game.user.targets.map(token => token.id);
}

export function getControlledTokens() {
    if (!game || !game.canvas) {
        return [];
    }
    return game.canvas.tokens?.controlled ?? [];
}

export function capitalizeFirstLetter(string) {
    return string[0].toUpperCase() + string.slice(1);
}

export function generateDiamonds(count) {
    const total = 6;
    const full = '◆';
    const empty = '◇';

    if (count < 0 || count > total) {
        throw new Error('Count must be between 0 and 6');
    }

    return full.repeat(count) + empty.repeat(total - count);
}

export function getSetting(label) {
    return game.settings.get(MODULE_ID, label)
}

export function getCurrentCommunity() {
    // Delegates to the system so the "current community" setting stays a single
    // source of truth; the type guard covers the setting pointing at a stale id.
    const community = game.tor2e?.macro?.utility?.getCommunity?.();
    return community?.type === 'community' ? community : null;
}

export function getImage(entity, defaultImages = []) {
    defaultImages.push("icons/svg/mystery-man.svg");
    let result = "";
    if (game.settings.get("token-action-hud-core", "displayIcons")) {
        result = (typeof entity === "string")
            ? entity
            : entity?.img ?? entity?.icon ?? "";
    }
    return !defaultImages.includes(result) ? result : "";
}