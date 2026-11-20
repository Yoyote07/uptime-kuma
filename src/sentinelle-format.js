// Format des nombres de Sentinelle : à la française, partout pareil.
// « 100 % », « 99,5 % », « 4,09 ms », « 152 ms »

const NBSP = " ";

/**
 * Nombre à la française, sans zéros inutiles
 * @param {number} value nombre
 * @param {number} digits décimales maximum
 * @returns {string} nombre formaté
 */
export function formatNumber(value, digits = 2) {
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(value);
}

/**
 * Disponibilité (ratio 0 à 1) en pourcentage : « 100 % », « 99,5 % »
 * Un ratio inférieur à 1 n'est jamais arrondi à « 100 % ».
 * @param {number} ratio disponibilité entre 0 et 1
 * @returns {string} pourcentage formaté, ou « – »
 */
export function formatPercent(ratio) {
    if (typeof ratio !== "number" || Number.isNaN(ratio)) {
        return "–";
    }
    let percent = Math.min(ratio, 1) * 100;
    if (ratio < 1 && percent > 99.99) {
        percent = 99.99;
    }
    const digits = percent >= 100 ? 0 : 2;
    return formatNumber(Math.floor(percent * 10 ** digits) / 10 ** digits, digits) + NBSP + "%";
}

/**
 * Temps de réponse : « 4,09 ms », « 152 ms » (2 décimales sous 10 ms, 1 sous 100 ms, entier au-delà)
 * @param {number} ms durée en millisecondes
 * @returns {string} durée formatée, ou « – »
 */
export function formatMs(ms) {
    if (typeof ms !== "number" || Number.isNaN(ms)) {
        return "–";
    }
    const digits = ms < 10 ? 2 : ms < 100 ? 1 : 0;
    return formatNumber(ms, digits) + NBSP + "ms";
}
