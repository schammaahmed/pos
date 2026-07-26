package com.pos.backend.service;

import com.pos.backend.dto.PreOrderDtos.PreOrderResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

// A tiny in-memory hub for pushing PreOrder status changes to whichever participant devices
// have the "meine Bestellungen" page open. Keyed by participantId, so a kid on both a phone
// AND a tablet gets the push on both.
//
// Emitters are wired to remove themselves on completion / timeout / error, which is what
// keeps the map from leaking as browser tabs come and go.
//
// Nothing here touches the database - the caller passes the already-serialised
// PreOrderResponse. That way the emitters live on the servlet's async thread pool without
// holding a Hibernate session open.
@Service
@Slf4j
public class PreOrderNotifier {

    // 30 minutes: long enough that the participant page usually stays connected for a full
    // "wait for the toast" cycle without reconnecting, short enough that a laptop lid
    // being closed for an hour doesn't keep a dead connection around forever.
    private static final long EMITTER_TIMEOUT_MS = 30L * 60 * 1000;

    private final ConcurrentHashMap<Long, Set<SseEmitter>> emittersByParticipant = new ConcurrentHashMap<>();

    /** Called by the SSE controller: returns an emitter ready to be handed back to Spring. */
    public SseEmitter register(long participantId) {
        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MS);
        Set<SseEmitter> set = emittersByParticipant
                .computeIfAbsent(participantId, id -> ConcurrentHashMap.newKeySet());
        set.add(emitter);

        Runnable removeEmitter = () -> {
            Set<SseEmitter> current = emittersByParticipant.get(participantId);
            if (current != null) {
                current.remove(emitter);
                if (current.isEmpty()) emittersByParticipant.remove(participantId, current);
            }
        };
        emitter.onCompletion(removeEmitter);
        emitter.onTimeout(removeEmitter);
        emitter.onError((t) -> removeEmitter.run());

        // Fire an immediate "hello" so the client knows the connection is live even before
        // the first real status change. Also flushes the response headers, which some proxies
        // buffer until they've seen actual content.
        try {
            emitter.send(SseEmitter.event().name("hello").data("ok"));
        } catch (IOException e) {
            emitter.completeWithError(e);
        }
        return emitter;
    }

    /** Called after any PreOrder transition. Broadcasts the current state to the participant's devices. */
    public void publish(PreOrderResponse response) {
        Set<SseEmitter> set = emittersByParticipant.get(response.participantId());
        if (set == null || set.isEmpty()) return;
        for (SseEmitter emitter : set) {
            try {
                emitter.send(SseEmitter.event().name("preorder").data(response));
            } catch (IOException e) {
                // client disconnected; the onError callback will remove this emitter
                emitter.completeWithError(e);
            }
        }
    }
}
