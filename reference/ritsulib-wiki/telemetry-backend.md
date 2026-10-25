## Scope

RitsuLib only handles consent, local queueing, routing, and payload assembly. Each applicant owns its fixed endpoint. A backend may be a Cloudflare Worker, FastAPI service, ASP.NET service, PostHog proxy, S3 writer, or any other service that accepts the same batch contract.

The public contract lives in:

- `schemas/telemetry/v1/openapi.yaml`
- `schemas/telemetry/v1/telemetry-batch.schema.json`
- `schemas/telemetry/v1/telemetry-event.schema.json`

Use the OpenAPI file with tools such as OpenAPI Generator, Kiota, NSwag, or Swagger Codegen. Use the JSON Schema files for runtime validation in workers, FastAPI, ASP.NET, Node, Rust, Go, or Java.


## Endpoint

The recommended endpoint is:

```text
POST /v1/ingest
Content-Type: application/json
```

Successful responses should return `200` or `202`:

```json
{
  "ok": true,
  "accepted": 2,
  "rejected": 0,
  "request_id": "optional-log-correlation-id"
}
```

Error responses should use a stable machine-readable `error` string:

```json
{
  "error": "invalid_schema",
  "message": "schema must be ritsulib.telemetry.batch.v1"
}
```


## Payload

A batch has a batch schema id, one applicant id, and one or more events:

```json
{
  "schema": "ritsulib.telemetry.batch.v1",
  "applicant_id": "author.some-mod",
  "events": [
    {
      "schema": "ritsulib.telemetry.v1",
      "applicantId": "author.some-mod",
      "eventName": "exception",
      "requestId": "diagnostics",
      "category": "Diagnostics",
      "timestampUtc": "2026-05-19T00:00:00Z",
      "properties": {
        "anonymous_install_id": "stable-anonymous-id",
        "session_id": "process-session-id",
        "ritsulib_version": "0.0.0",
        "applicant_id": "author.some-mod",
        "owner_mod_id": "author.some-mod",
        "payload_kind": "exception",
        "exception_type": "System.Exception"
      },
      "payload": {
        "applicant_payload": {
          "exception": {
            "type": "System.Exception",
            "message": "example",
            "stack_trace": "..."
          }
        }
      }
    }
  ]
}
```

Backends should index `properties` first. Full `payload` should be stored as JSON/blob. Promote only the fields needed for dashboards or search.

`payload` may contain `base_payload`, `private_contributions`, `shared_contributions`, and `applicant_payload`. Private contributions are data supplied by the applicant's own mod. Shared contributions are data from another mod source and are only included after explicit source consent.


## Backend Checklist

- Validate `schema` and `event.schema`.
- Validate `applicant_id` and every `event.applicantId` against the endpoint owner.
- Enforce request body size and event count limits.
- Reject or quarantine unknown schema versions instead of silently reshaping them.
- Store raw events before forwarding to analytics if durability matters.
- Keep personal, secret, and warehouse write keys on the server. A PostHog project token used by its public
  capture endpoint is not a substitute for those private credentials.
- Keep an append-only raw table or object store for later reprocessing.
- Promote query-critical fields from `properties` and selected payload paths into indexed columns.
