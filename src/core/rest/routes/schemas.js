const express = require("express");
const schemas = require("../../schemas");

module.exports = () => {
  const router = express.Router();

  router.get("/:param?", (req, res) => {
    const { param } = req.params;
    res.json(schemas.find(param));
  });

  return router;
};
