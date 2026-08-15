export const PAGE_SIZE = 10;

export function paginate(items, page = 1, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  return { items: pageItems, totalPages, currentPage };
}

// prefix identifies which list is being paged, e.g. "upload:anime",
// "edit:movie", "delete:series". Produces callback_data like
// "page:upload:anime:2", kept short and well under Telegram's 64-byte limit.
export function buildPaginationRow(prefix, currentPage, totalPages) {
  return [
    {
      text: '⬅️ Previous',
      callback_data:
        currentPage > 1 ? `page:${prefix}:${currentPage - 1}` : 'noop',
    },
    { text: `${currentPage}/${totalPages}`, callback_data: 'noop' },
    {
      text: 'Next ➡️',
      callback_data:
        currentPage < totalPages ? `page:${prefix}:${currentPage + 1}` : 'noop',
    },
  ];
}
