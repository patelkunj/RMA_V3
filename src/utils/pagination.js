const paginatedData = (items, { total, page, limit }, legacyCollectionKey) => {
    const totalPages = Math.ceil(total / limit);
    return {
        items,
        ...(legacyCollectionKey && legacyCollectionKey !== "items" ? { [legacyCollectionKey]: items } : {}),
        total,
        page,
        limit,
        totalPages,
        pagination: { total, page, limit, totalPages },
    };
};

export { paginatedData };
