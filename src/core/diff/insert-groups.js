export function insertGroups(original, insertGroups) {
    // Sort groups by index to maintain order
    insertGroups.sort((a, b) => a.index - b.index);
    let result = [];
    let lastIndex = 0;
    insertGroups.forEach(({ index, elements }) => {
        // Add elements from original array up to insertion point
        result.push(...original.slice(lastIndex, index));
        // Add the group of elements
        result.push(...elements);
        lastIndex = index;
    });
    // Add remaining elements from original array
    result.push(...original.slice(lastIndex));
    return result;
}
//# sourceMappingURL=insert-groups.js.map