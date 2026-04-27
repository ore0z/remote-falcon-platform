package com.remotefalcon.external.api.configuration;

import com.remotefalcon.external.api.response.RequestVoteResponse;
import com.remotefalcon.external.api.response.ShowResponse;
import com.remotefalcon.library.documents.Show;
import com.remotefalcon.library.models.Preference;
import com.remotefalcon.library.models.Request;
import com.remotefalcon.library.models.Sequence;
import com.remotefalcon.library.models.SequenceGroup;
import com.remotefalcon.library.models.Vote;
import org.springframework.aot.hint.MemberCategory;
import org.springframework.aot.hint.RuntimeHints;
import org.springframework.aot.hint.RuntimeHintsRegistrar;

public class DozerRuntimeHints implements RuntimeHintsRegistrar {
    @Override
    public void registerHints(RuntimeHints hints, ClassLoader classLoader) {
        register(hints, Show.class);
        register(hints, Preference.class);
        register(hints, Sequence.class);
        register(hints, SequenceGroup.class);
        register(hints, Request.class);
        register(hints, Vote.class);
        register(hints, ShowResponse.class);
        register(hints, ShowResponse.Preference.class);
        register(hints, ShowResponse.Sequence.class);
        register(hints, ShowResponse.SequenceGroup.class);
        register(hints, ShowResponse.Request.class);
        register(hints, ShowResponse.Vote.class);
        register(hints, RequestVoteResponse.class);
    }

    private static void register(RuntimeHints hints, Class<?> type) {
        hints.reflection().registerType(type,
                MemberCategory.INVOKE_DECLARED_CONSTRUCTORS,
                MemberCategory.INVOKE_DECLARED_METHODS,
                MemberCategory.INVOKE_PUBLIC_METHODS,
                MemberCategory.DECLARED_FIELDS);
    }
}
