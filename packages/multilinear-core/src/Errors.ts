/**
 * Tracker error types. Browser-safe (effect only) so the web client can
 * decode errors coming over the HTTP surface.
 */
import * as Schema from "effect/Schema";

export class TrackerStorageError extends Schema.TaggedErrorClass<TrackerStorageError>()(
  "TrackerStorageError",
  {
    operation: Schema.String,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Tracker storage failed during ${this.operation}`;
  }
}

export class IssueNotFoundError extends Schema.TaggedErrorClass<IssueNotFoundError>()(
  "IssueNotFoundError",
  {
    issueId: Schema.String,
  },
) {
  override get message(): string {
    return `Issue not found: ${this.issueId}`;
  }
}

export class ImportRejectedError extends Schema.TaggedErrorClass<ImportRejectedError>()(
  "ImportRejectedError",
  {
    line: Schema.Int,
    reason: Schema.String,
  },
) {
  override get message(): string {
    return `Import rejected at line ${this.line}: ${this.reason}`;
  }
}
