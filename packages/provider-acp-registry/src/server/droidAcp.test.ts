import type { AcpAdapterV2Flavor } from "@t3tools/provider-acp/server/adapter";
import { expect, it } from "vite-plus/test";

import { extractDroidElicitationForm } from "./droidAcp.ts";

type ElicitationRequest = Parameters<NonNullable<AcpAdapterV2Flavor["extractElicitationForm"]>>[0];

const form = extractDroidElicitationForm({
  mode: "form",
  sessionId: "session-id",
  message: "Questions",
  requestedSchema: {
    type: "object",
    properties: {
      question_1: {
        type: "string",
        title: "Rollout",
        description: "How should this ship?",
        oneOf: [
          { const: "option_1", title: "Incremental" },
          { const: "other", title: "Other" },
        ],
      },
      question_1_other: { type: "string" },
    },
    required: ["question_1"],
  },
} as ElicitationRequest);

it.each([['\n\nAttached image "shot.png": "/tmp/shot.png"'], ["\n\nNote: behind a flag"]])(
  "sends the selected option's label with appended text %j",
  (suffix) => {
    expect(form?.respond({ question_1: `option_1${suffix}` })).toEqual({
      action: "accept",
      content: { question_1: "other", question_1_other: `Incremental${suffix}` },
    });
  },
);
