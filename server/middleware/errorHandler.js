// NOTE: If a request doesn't match any route, this sends back a 404 JSON response.
export const notFound = (req, res, _next) => {
  void _next;
  res.status(404).json({
    message: "Route not found.",
    requestId: req.requestId,
  });
};

// NOTE: Any thrown error ends up here so we return a clean JSON error to the client.
export const errorHandler = (err, req, res, _next) => {
  void _next;
  const isMulterError = err?.name === "MulterError";
  const isFileSystemError = /^(ENOENT|EACCES|EPERM|ENOTDIR|EMFILE)/.test(err.code || "");
  const status = err.statusCode || (isMulterError || isFileSystemError ? 400 : 500);
  const message =
    isMulterError && err.code === "LIMIT_FILE_SIZE"
      ? "Image is too large. Max size is 3 MB."
      : isFileSystemError
        ? "File storage error. Please try again."
        : err.message || "Server error.";
  req.log?.error?.(
    { err, status, requestId: req.requestId },
    "Request failed.",
  );
  res.status(status).json({
    message,
    requestId: req.requestId,
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
}; 

