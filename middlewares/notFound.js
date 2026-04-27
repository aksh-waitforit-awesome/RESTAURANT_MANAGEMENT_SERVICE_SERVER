function notFound(req, res){
  return res.status(404).json({message : "route not found"})
};

module.exports = notFound;
