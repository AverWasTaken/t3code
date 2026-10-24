import { useMemo } from "react";
import { ScrollView, View } from "react-native";
import type { OrchestrationV2TurnItem } from "@t3tools/contracts";
import { INLINE_EDIT_AWAITING_REVIEW_TITLE, inlineEditPreview } from "@t3tools/shared/inlineEdit";
import { AppText as Text } from "../../components/ui/AppText";
import { useUniwindTheme } from "../../lib/useUniwindTheme";
import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";
import { buildReviewParsedDiff } from "../review/reviewModel";
import {
  buildNativeReviewDiffData,
  createNativeReviewDiffTheme,
} from "../review/nativeReviewDiffAdapter";

export function InlineEditPatch(props: {
  readonly item: Extract<OrchestrationV2TurnItem, { type: "file_change" }>;
  readonly pending: boolean;
  readonly error: string | null;
}) {
  const item = props.item;
  const appTheme = useUniwindTheme();
  const { themeAppearance, themeId } = useAppearancePreferences();
  const theme = useMemo(
    () => createNativeReviewDiffTheme(themeAppearance, themeId, appTheme),
    [themeAppearance, themeId, appTheme],
  );
  const preview = useMemo(
    () => inlineEditPreview(item.diffStr ?? "", item.diffTruncated),
    [item.diffStr, item.diffTruncated],
  );
  const parsed = useMemo(
    () =>
      item.status === "completed" &&
      item.title !== INLINE_EDIT_AWAITING_REVIEW_TITLE &&
      preview.isPatch &&
      !preview.limited
        ? buildReviewParsedDiff(preview.text, "inline-edit")
        : null,
    [item.status, item.title, preview],
  );
  const rows = useMemo(
    () => (parsed?.kind === "files" ? buildNativeReviewDiffData(parsed).rows : []),
    [parsed],
  );
  if (item.title === INLINE_EDIT_AWAITING_REVIEW_TITLE)
    return (
      <Text className="text-xs text-foreground-muted">
        Awaiting review. This edit has not been applied.
      </Text>
    );
  if (item.status !== "completed")
    return (
      <Text className="text-xs text-foreground-muted">
        {item.status === "failed"
          ? item.diffStr || "Edit failed."
          : "This edit has not completed successfully."}
      </Text>
    );
  if (!preview.isPatch)
    return (
      <Text className="text-xs text-foreground-muted">
        {props.pending
          ? "Loading edit patch..."
          : props.error
            ? `Couldn't load edit patch: ${props.error}`
            : "Patch unavailable for this edit."}
      </Text>
    );
  return (
    <View>
      {preview.limited ? (
        <Text className="text-xs text-foreground-muted">Patch preview truncated.</Text>
      ) : parsed?.kind === "raw" ? (
        <Text className="text-xs text-foreground-muted">{parsed.reason}</Text>
      ) : null}
      <ScrollView nestedScrollEnabled style={{ maxHeight: 360, backgroundColor: theme.background }}>
        <ScrollView horizontal nestedScrollEnabled>
          <View>
            {rows.length > 0
              ? rows.map((row) => (
                  <Text
                    key={row.id}
                    selectable
                    className="font-mono text-2xs leading-normal"
                    style={{
                      backgroundColor:
                        row.change === "add"
                          ? theme.addBackground
                          : row.change === "delete"
                            ? theme.deleteBackground
                            : theme.background,
                      color:
                        row.change === "add"
                          ? theme.addText
                          : row.change === "delete"
                            ? theme.deleteText
                            : theme.text,
                    }}
                  >
                    {row.kind === "file"
                      ? row.filePath
                      : row.kind === "line"
                        ? `${row.change === "add" ? "+" : row.change === "delete" ? "-" : " "}${row.content ?? ""}`
                        : row.text || " "}
                  </Text>
                ))
              : preview.lines.map((line, index) => (
                  <Text
                    key={index}
                    selectable
                    className="font-mono text-2xs leading-normal"
                    style={{
                      backgroundColor:
                        line.startsWith("+") && !line.startsWith("+++ ")
                          ? theme.addBackground
                          : line.startsWith("-") && !line.startsWith("--- ")
                            ? theme.deleteBackground
                            : theme.background,
                      color:
                        line.startsWith("+") && !line.startsWith("+++ ")
                          ? theme.addText
                          : line.startsWith("-") && !line.startsWith("--- ")
                            ? theme.deleteText
                            : theme.text,
                    }}
                  >
                    {line || " "}
                  </Text>
                ))}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}
