/**
 * Checks if the connected ClickHouse instance meets the minimum version requirements
 * @param client ClickHouse client instance
 * @throws Error if version requirements are not met
 */
export const checkClickHouseVersion = async (client) => {
    const result = await client.query({
        query: 'SELECT version()'
    }).then(res => res.json());
    const [{ version }] = result;
    const [major, minor] = version.split('.').map(Number);
    if (major < 24 || (major === 24 && minor < 10)) {
        throw new Error('ClickHouse v24.10+ is required for JSON field support');
    }
};
/**
 * Derives the namespace from a given ID
 * For paths with API endpoints (e.g., docs.example.com/api), returns the full domain (docs.example.com)
 * For domain-only paths (e.g., docs.example.com), returns the parent domain (example.com)
 * @param id The document ID to derive namespace from
 * @returns The derived namespace
 */
export function deriveNamespace(id) {
    if (!id)
        return '';
    // Remove protocol if present
    const cleanId = id.replace(/^https?:\/\//, '');
    // Split by path separator
    const [domain, ...pathParts] = cleanId.split('/');
    // If there are path parts, return the full domain
    if (pathParts.length > 0) {
        return domain;
    }
    // For domain-only paths, return parent domain
    const domainParts = domain.split('.');
    if (domainParts.length <= 2)
        return domain;
    return domainParts.slice(1).join('.');
}
