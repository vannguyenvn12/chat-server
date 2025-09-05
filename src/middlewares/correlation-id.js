const { ulid } = require('ulid');

module.exports = function correlationId() {
    return (req, res, next) => {
        const incoming =
            req.get('x-correlation-id') ||
            req.query.correlation_id ||
            req.body?.correlation_id ||
            req.body?.id; // giữ tương thích cũ

        const id = (incoming && String(incoming).trim()) || `req_${ulid()}`;
        req.correlationId = id;

        // tiện cho trace trên client / log aggregator
        res.set('x-correlation-id', id);

        next();
    };
};
