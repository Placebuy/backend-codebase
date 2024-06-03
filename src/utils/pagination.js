const mongoose = require('mongoose');

/**
 * Parses the query string from the request.
 * @param {string} queryString - The query string to parse.
 * @returns {Object} - The parsed query object.
 */
function parseQuery(queryString) {
  if (!queryString) return {};
  return JSON.parse(Buffer.from(queryString, 'base64').toString('utf-8'));
}

/**
 * Paginates the results for a Mongoose model.
 * @param {Model} model - The Mongoose model to paginate.
 * @param {Object} req - The Express request object.
 * @param {Object} additionalQuery - Additional query conditions.
 * @returns {Object} - The metadata and results for the paginated query.
 */
async function paginate(model, req, additionalQuery = {}) {
  const { page = 1, size = 10, q } = req.query;

  const parsedPage = parseInt(page, 10);
  const parsedSize = parseInt(size, 10);

  const currentPage = parsedPage > 0 ? parsedPage : 1;
  const limit = parsedSize > 0 ? parsedSize : 10;

  const parsedClientQuery = parseQuery(q);

  // Merge the parsed client query with any additional query conditions
  const finalQuery = { ...parsedClientQuery, ...additionalQuery };

  const totalResults = await model.countDocuments(finalQuery);

  const totalPages = Math.ceil(totalResults / limit);
  const offset = (currentPage - 1) * limit;

  const query = model.find(finalQuery).skip(offset).limit(limit);

  if (req.query.sort) {
    query.sort(req.query.sort);
  }

  const results = await query.exec();

  const metadata = {
    totalResults,
    totalPages,
    currentPage,
    size: limit,
    hasNext: currentPage < totalPages,
    hasPrevious: currentPage > 1,
    nextPage: currentPage < totalPages ? currentPage + 1 : null,
    previousPage: currentPage > 1 ? currentPage - 1 : null,
  };

  return { metadata, results };
}

module.exports = {
  paginate,
};
