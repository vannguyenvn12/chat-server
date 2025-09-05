/**
 * Tạo query phân trang cursor theo created_at.
 * - direction: "backward" (cuộn lên: lấy cũ hơn) hoặc "forward"
 * - cursor: ISO date string (client giữ lại created_at của item rìa)
 */
function buildTimeCursorQuery(base, { cursor, direction = 'backward' }) {
    const q = { ...base };
    if (!cursor) return q;
    const date = new Date(cursor);
    if (Number.isNaN(date.getTime())) return q;

    // backward: lấy < cursor (cũ hơn)
    // forward:  lấy > cursor (mới hơn)
    q.created_at = direction === 'forward'
        ? { $gt: date }
        : { $lt: date };

    return q;
}

module.exports = { buildTimeCursorQuery };
