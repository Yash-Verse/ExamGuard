const { MAX_PAGE_SIZE } = require('../config/constants');
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
const pageMeta = (page, limit, total) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });
module.exports = { parsePagination, pageMeta };
