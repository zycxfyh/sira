module.exports = (transformSpecs, egContext, obj) => {
  if (transformSpecs.add) {
    Object.keys(transformSpecs.add).forEach(addParam => {
      try {
        // Use safe evaluation instead of dangerous run method
        obj[addParam] = egContext.safeEval(transformSpecs.add[addParam]);
      } catch (error) {
        console.warn(`Failed to evaluate transformation for ${addParam}:`, error.message);
        // Skip transformation if evaluation fails
      }
    });
  }
  if (transformSpecs.remove) {
    transformSpecs.remove.forEach(removeParam => {
      delete obj[removeParam];
    });
  }

  return obj;
};
