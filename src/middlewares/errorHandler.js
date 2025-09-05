module.exports = (err, req, res, next) => {
    console.error('[error]', err);
    const status = err.status || 500;
    res.status(status).json({
        error: true,
        message: err.message || 'Internal Server Error'
    });
};
