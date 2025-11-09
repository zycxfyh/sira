module.exports = (params) => (_req, res, _next) =>
  res.status(params.statusCode).send(params.message);
