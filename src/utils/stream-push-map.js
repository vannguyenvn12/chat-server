// stream-push-map.js
const { ulid } = require('ulid');
const map = new Map();

function getOrCreateStoragePushId(conversation_id, stream_key) {
    const k = `${conversation_id}:${stream_key}`;
    if (!map.has(k)) map.set(k, ulid());
    return map.get(k);
}

function clearStoragePushId(conversation_id, stream_key) {
    map.delete(`${conversation_id}:${stream_key}`);
}

module.exports = { getOrCreateStoragePushId, clearStoragePushId };
