export function getTargetedTokens() {
    if (!game || !game.user || !game.user.targets) {
        return [];
    }
    return game.user.targets.map(token => token.id);
}