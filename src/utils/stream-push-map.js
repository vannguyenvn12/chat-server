// utils/stream-push-map.js
const map = new Map();
// key: `${conversation_id}::${stream_key}`
// val: { push_id: string, me_id?: string }

function keyOf(conversation_id, stream_key) {
    return `${conversation_id}::${stream_key}`;
}

function getState(conversation_id, stream_key) {
    return map.get(keyOf(conversation_id, stream_key)) || null;
}

function setState(conversation_id, stream_key, state) {
    map.set(keyOf(conversation_id, stream_key), state);
}

function getOrCreateState(conversation_id, stream_key, createPushId) {
    const k = keyOf(conversation_id, stream_key);
    if (!map.has(k)) {
        map.set(k, { push_id: createPushId() });
    }
    return map.get(k);
}

function clearState(conversation_id, stream_key) {
    map.delete(keyOf(conversation_id, stream_key));
}

module.exports = {
    getState,
    setState,
    getOrCreateState,
    clearState,
};
