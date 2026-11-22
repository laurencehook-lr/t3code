import { EnvironmentId, RuntimeRequestId, ThreadId } from "@t3tools/contracts";
import type { ReactNode } from "react";
import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { render } from "../../../test/render";
import type { PendingUserInput } from "../../session-logic";
import { Select, SelectTrigger } from "../ui/select";
import { ComposerPendingUserInputPanel } from "./ComposerPendingUserInputPanel";

const threadRef = { environmentId: EnvironmentId.make("env"), threadId: ThreadId.make("thread") };

const prompt: PendingUserInput = {
  requestId: RuntimeRequestId.make("question-shortcuts"),
  createdAt: "2026-10-31T00:00:00.000Z",
  dismissible: false,
  responseCapability: "live",
  questions: [
    {
      id: "question",
      header: "Rollout",
      question: "How should this ship?",
      options: [{ label: "Incremental", description: "One module at a time" }],
      multiSelect: true,
    },
  ],
};

it.each<{ focus: string; control: ReactNode; toggles: boolean; focusLabel?: string }>([
  { focus: "a page button", control: <button type="button" aria-label="Focused" />, toggles: true },
  {
    focus: "a dialog",
    control: (
      <div role="dialog">
        <button type="button" aria-label="Focused" />
      </div>
    ),
    toggles: false,
  },
  {
    focus: "a popup",
    control: (
      <div data-slot="menu-popup">
        <button type="button" aria-label="Focused" />
      </div>
    ),
    toggles: false,
  },
  {
    focus: "a menu",
    control: (
      <div role="menu">
        <button type="button" role="menuitem" aria-label="Focused" />
      </div>
    ),
    toggles: false,
  },
  {
    focus: "a select",
    control: (
      <select aria-label="Focused">
        <option>One</option>
      </select>
    ),
    toggles: false,
  },
  {
    focus: "a closed select menu",
    control: (
      <Select>
        <SelectTrigger aria-label="Focused" />
      </Select>
    ),
    toggles: false,
  },
  {
    focus: "a device screen that takes the key",
    control: (
      <div
        role="application"
        aria-label="Focused"
        tabIndex={0}
        onKeyDown={(event) => event.preventDefault()}
      />
    ),
    toggles: false,
  },
  {
    focus: "the answer's note box",
    control: null,
    toggles: false,
    focusLabel: "Note for this answer",
  },
])(
  "digit shortcut with focus in $focus toggles an option: $toggles",
  async ({ control, toggles, focusLabel = "Focused" }) => {
    const onToggleOption = vi.fn();
    await using screen = await render(
      <>
        {control}
        <ComposerPendingUserInputPanel
          pendingUserInputs={[prompt]}
          cwd={undefined}
          threadRef={threadRef}
          respondingRequestIds={[]}
          answers={{}}
          questionIndex={0}
          onToggleOption={onToggleOption}
          onChangeNote={vi.fn()}
          onAdvance={vi.fn()}
          onDismiss={vi.fn()}
        />
      </>,
    );
    await expect.element(screen.getByText("Incremental")).toBeVisible();
    screen.getByLabelText(focusLabel).element().focus();

    await userEvent.keyboard("1");

    expect(onToggleOption.mock.calls).toEqual(toggles ? [["question", "Incremental"]] : []);
  },
);

it("types digits into the note box and submits it with Enter or Mod+Enter", async () => {
  const onToggleOption = vi.fn();
  const onChangeNote = vi.fn();
  const onAdvance = vi.fn();
  await using screen = await render(
    <ComposerPendingUserInputPanel
      pendingUserInputs={[prompt]}
      cwd={undefined}
      threadRef={threadRef}
      respondingRequestIds={[]}
      answers={{ question: { selectedOptionValues: ["Incremental"] } }}
      questionIndex={0}
      onToggleOption={onToggleOption}
      onChangeNote={onChangeNote}
      onAdvance={onAdvance}
      onDismiss={vi.fn()}
    />,
  );

  await userEvent.click(screen.getByLabelText("Note for this answer"));
  await userEvent.keyboard("12");
  await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
  expect(onAdvance).not.toHaveBeenCalled();
  await userEvent.keyboard("{Enter}");
  await userEvent.keyboard("{ControlOrMeta>}{Enter}{/ControlOrMeta}");

  expect(onToggleOption).not.toHaveBeenCalled();
  expect(onChangeNote.mock.calls).toEqual([
    ["question", "1"],
    ["question", "2"],
  ]);
  expect(onAdvance).toHaveBeenCalledTimes(2);
});
