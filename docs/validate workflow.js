const createN01Validators = function createN01Validators({ makeError } = {}) {
  const COMMAND_VERSION_VALUE = "pulso-workflow-command.v1";
  const RESULT_VERSION_VALUE = "pulso-workflow-result.v1";
  const WORKFLOW_CODE_VALUES = ["PE01", "PE02", "PE03", "PE04", "PE05", "PE06", "PE07", "PE08", "PE09", "PE10", "PE11", "PE12"];
  const ACTOR_KINDS = ["HUMAN", "AGENT", "POLICY_ENGINE", "MOCK_SERVICE"];
  const SENSITIVE_ACTIONS = ["AUTHORIZE_MONEY", "PROMISE_DATE", "CHANGE_SCOPE", "ACCEPT_CONTRACT", "CLOSE_CASE", "MARK_VALIDATED", "ACTIVATE_POLICY"];
  const NON_SENSITIVE_ACTIONS = ["PREPARE_ACK", "REQUEST_MISSING_INFORMATION", "PRIORITIZE_ITEM"];
  const AUTHORITY_OUTCOMES = ["AUTO_ELIGIBLE", "REQUIRE_APPROVAL", "APPROVED", "DENIED"];
  const TRANSITION_CLASSES = ["OBSERVATION", "PROGRESS", "VERIFICATION", "RESOLUTION", "CLOSURE", "REOPEN"];
  const ENTITY_KINDS = ["Message", "Conversation", "Case", "Commitment", "Assignment", "Decision", "Draft", "Delivery", "RuleProposal"];
  const COVERAGE_STATUSES = ["COMPLETE", "PARTIAL", "STALE", "FAILED", "UNKNOWN"];
  const OBSERVATION_KINDS = ["EXPERIMENTAL_DUE_WINDOW_OBSERVED", "EXPERIMENTAL_DUE_BREACH_OBSERVED", "NO_RELEVANT_CHANGE_OBSERVED"];
  const RETRY_REASONS = ["COMPLETED", "COMPLETED_AFTER_RETRY", "IDEMPOTENT_REPLAY", "CONTROLLED_LOCAL_DEPENDENCY_FAILURE", "FAILED_CLOSED"];
  const ERROR_CATEGORIES = ["VALIDATION", "DEPENDENCY", "IDEMPOTENCY", "RUNTIME"];
  const WHATSAPP_COMMANDS = ["OPEN_ITEM", "SHOW_STATUS", "REQUEST_REVIEW"];
  const OUTCOMES = {
    PE01: ["RECORDED", "DUPLICATE_SUPPRESSED", "FAILED_CLOSED"],
    PE02: ["AUTO_ELIGIBLE", "REQUIRE_APPROVAL", "APPROVED", "DENIED", "DUPLICATE_SUPPRESSED", "FAILED_CLOSED"],
    PE03: ["PREPARED", "SIMULATED", "HELD_FOR_APPROVAL", "DENIED", "DUPLICATE_SUPPRESSED", "FAILED_CLOSED"],
    PE04: ["ASSIGNMENT_RECORDED", "ASSIGNMENT_RETURNED", "DUPLICATE_SUPPRESSED", "FAILED_CLOSED"],
    PE05: ["RETURN_RECORDED", "DUPLICATE_SUPPRESSED", "FAILED_CLOSED"],
    PE06: ["DUE_WINDOW_VISIBLE", "DUE_BREACH_VISIBLE", "NO_ACTION", "DUPLICATE_SUPPRESSED", "FAILED_CLOSED"],
    PE07: ["PREPARED", "SIMULATED", "HELD_FOR_APPROVAL", "DENIED", "DUPLICATE_SUPPRESSED", "FAILED_CLOSED"],
    PE08: ["ROUTED_TO_UI", "DUPLICATE_SUPPRESSED", "FAILED_CLOSED"],
    PE09: ["CASE_CORRELATED", "DUPLICATE_SUPPRESSED", "FAILED_CLOSED"],
    PE10: ["DELIVERY_CONFIRMED", "DUPLICATE_SUPPRESSED", "FAILED_CLOSED"],
    PE11: ["COVERAGE_COMPLETE", "COVERAGE_DEGRADED_VISIBLE", "DUPLICATE_SUPPRESSED", "FAILED_CLOSED"],
    PE12: ["VERIFIED", "RESOLVED", "CLOSED", "REOPENED", "DUPLICATE_SUPPRESSED", "FAILED_CLOSED"]
  };
  const COMMAND_KEYS = ["contractVersion", "workflowCode", "requestId", "correlationId", "idempotencyKey", "occurredAt", "payload"];
  const RESULT_KEYS = ["contractVersion", "workflowCode", "requestId", "correlationId", "idempotencyKey", "outcome", "outputRefs", "retry", "coverage", "errors", "externalEffects", "networkAccess"];
  const PAYLOAD_KEYS = {
    PE01: ["itemRef"],
    PE02: ["subjectRef", "actionRequest", "policyBundleRef"],
    PE03: ["draftId", "revision", "payload", "decision"],
    PE04: ["assignmentRef", "transition", "eventId"],
    PE05: ["conversationRef", "messageRef", "transition", "eventId"],
    PE06: ["clockRef", "observedAt", "subjectRef", "observationKind", "ruleRefs"],
    PE07: ["draftId", "revision", "payload", "decision"],
    PE08: ["commandCode", "commandText", "subjectRef", "actor"],
    PE09: ["itemRef", "caseRef", "conversationRefs"],
    PE10: ["deliveryIdempotencyKey", "deliveryRef", "observedAt"],
    PE11: ["observedAt", "requiredSourceRefs"],
    PE12: ["transition", "eventId"]
  };
  const OUTPUT_KEYS = {
    PE01: ["itemRef", "claimId", "inferenceId", "eventIds"],
    PE02: ["decision", "appliedRuleRef", "replayHash", "attentionRefs"],
    PE03: ["draftIdentity", "effectId"],
    PE04: ["eventId", "assignmentRef", "state", "returned", "closed"],
    PE05: ["eventId", "entityRef", "state", "resolved", "closed"],
    PE06: ["eventIds", "subjectRefs", "nextCheckAt", "transition", "attention", "appliedRuleRefs"],
    PE07: ["draftIdentity", "effectId", "recipientRef"],
    PE08: ["uiRef", "authorityGranted", "stateChanged", "effectId"],
    PE09: ["itemRef", "caseRef", "conversationRefs", "coverageStatus", "state"],
    PE10: ["deliveryRef", "status", "effectId", "discrepancyCodes"],
    PE11: ["coverageStatus", "calmPermitted", "discrepancyCodes", "actions", "replayHash"],
    PE12: ["eventId", "entityRef", "state", "verified", "resolved", "closed", "reopened"]
  };
  const EMPTY_OUTPUTS = {
    PE01: { itemRef: null, claimId: null, inferenceId: null, eventIds: [] },
    PE02: { decision: null, appliedRuleRef: null, replayHash: null, attentionRefs: [] },
    PE03: { draftIdentity: null, effectId: null },
    PE04: { eventId: null, assignmentRef: null, state: null, returned: false, closed: false },
    PE05: { eventId: null, entityRef: null, state: null, resolved: false, closed: false },
    PE06: { eventIds: [], subjectRefs: [], nextCheckAt: null, transition: null, attention: null, appliedRuleRefs: [] },
    PE07: { draftIdentity: null, effectId: null, recipientRef: null },
    PE08: { uiRef: null, authorityGranted: false, stateChanged: false, effectId: null },
    PE09: { itemRef: null, caseRef: null, conversationRefs: [], coverageStatus: "UNKNOWN", state: null },
    PE10: { deliveryRef: null, status: null, effectId: null, discrepancyCodes: [] },
    PE11: { coverageStatus: "UNKNOWN", calmPermitted: false, discrepancyCodes: [], actions: [], replayHash: null },
    PE12: { eventId: null, entityRef: null, state: null, verified: false, resolved: false, closed: false, reopened: false }
  };

  function buildError(code, message, context = {}) {
    if (typeof makeError === "function") return makeError(code, message, context);
    const error = new Error(`${code}: ${message}`);
    error.name = "N01ContractError";
    error.code = code;
    error.context = JSON.parse(JSON.stringify(context));
    return error;
  }

  function fail(code, message, context = {}) {
    throw buildError(code, message, context);
  }

  function assert(condition, code, message, context = {}) {
    if (!condition) fail(code, message, context);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function exactObject(value, keys, path) {
    assert(value !== null && typeof value === "object" && !Array.isArray(value), "N01_OBJECT_REQUIRED", `${path} must be an object`, { path });
    const unexpected = Object.keys(value).find((key) => !keys.includes(key));
    assert(unexpected === undefined, "N01_FIELD_UNKNOWN", `${path}.${unexpected} is not allowed`, { path, unexpected });
    for (const key of keys) assert(Object.prototype.hasOwnProperty.call(value, key), "N01_FIELD_REQUIRED", `${path}.${key} is required`, { path, key });
  }

  function nonEmpty(value, path) {
    assert(typeof value === "string" && value.trim().length > 0, "N01_STRING_REQUIRED", `${path} must be a non-empty string`, { path });
  }

  function safeIdentifier(value, path) {
    nonEmpty(value, path);
    assert(!/^[a-z][a-z0-9+.-]*:\/\//i.test(value), "N01_EXTERNAL_REF_FORBIDDEN", `${path} cannot be an external reference`, { path });
  }

  function localRef(value, path) {
    nonEmpty(value, path);
    assert(value.startsWith("local://"), "N01_LOCAL_REF_REQUIRED", `${path} must use local://`, { path });
  }

  function isRfc3339(value) {
    if (typeof value !== "string") return false;
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
    if (!match) return false;
    const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetSign, offsetHourText, offsetMinuteText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day < 1 || day > days[month - 1]) return false;
    if (offsetSign !== undefined && (Number(offsetHourText) > 23 || Number(offsetMinuteText) > 59)) return false;
    return true;
  }

  function timestamp(value, path) {
    assert(isRfc3339(value), "N01_TIMESTAMP_INVALID", `${path} must be a real RFC 3339 calendar date-time`, { path });
  }

  function uniqueArray(value, path, { allowEmpty = false } = {}) {
    assert(Array.isArray(value) && (allowEmpty || value.length > 0), "N01_ARRAY_REQUIRED", `${path} must be an array`, { path });
    assert(new Set(value.map((entry) => JSON.stringify(entry))).size === value.length, "N01_ARRAY_DUPLICATE", `${path} cannot contain duplicates`, { path });
  }

  function localRefArray(value, path, options = {}) {
    uniqueArray(value, path, options);
    value.forEach((entry, index) => localRef(entry, `${path}[${index}]`));
  }

  function identifierArray(value, path, options = {}) {
    uniqueArray(value, path, options);
    value.forEach((entry, index) => safeIdentifier(entry, `${path}[${index}]`));
  }

  function nullableIdentifier(value, path) {
    if (value !== null) safeIdentifier(value, path);
  }

  function validateActor(actor, path) {
    exactObject(actor, ["actorId", "actorKind"], path);
    safeIdentifier(actor.actorId, `${path}.actorId`);
    assert(ACTOR_KINDS.includes(actor.actorKind), "N01_ACTOR_KIND_INVALID", `${path}.actorKind is invalid`, { path });
  }

  function validateAuthorityDecision(decision, path) {
    exactObject(decision, ["contractVersion", "decisionId", "action", "proposedBy", "policyDecidedBy", "approvedBy", "executedBy", "outcome", "expectedVersion", "effectMode"], path);
    assert(decision.contractVersion === "authority-decision.v1", "N01_AUTHORITY_VERSION_INVALID", `${path}.contractVersion is invalid`);
    safeIdentifier(decision.decisionId, `${path}.decisionId`);
    exactObject(decision.action, ["actionType", "sensitivity", "subjectRef"], `${path}.action`);
    nonEmpty(decision.action.actionType, `${path}.action.actionType`);
    localRef(decision.action.subjectRef, `${path}.action.subjectRef`);
    const catalogSensitivity = SENSITIVE_ACTIONS.includes(decision.action.actionType)
      ? "SENSITIVE"
      : NON_SENSITIVE_ACTIONS.includes(decision.action.actionType)
        ? "NON_SENSITIVE"
        : null;
    assert(catalogSensitivity !== null, "N01_ACTION_TYPE_UNKNOWN", `${path}.action.actionType is not catalogued`);
    assert(decision.action.sensitivity === catalogSensitivity, "N01_ACTION_SENSITIVITY_MISMATCH", `${path}.action.sensitivity contradicts the catalog`);
    validateActor(decision.proposedBy, `${path}.proposedBy`);
    validateActor(decision.policyDecidedBy, `${path}.policyDecidedBy`);
    assert(decision.policyDecidedBy.actorKind === "POLICY_ENGINE", "N01_POLICY_ACTOR_INVALID", `${path}.policyDecidedBy must be POLICY_ENGINE`);
    if (decision.approvedBy !== null) validateActor(decision.approvedBy, `${path}.approvedBy`);
    if (decision.executedBy !== null) validateActor(decision.executedBy, `${path}.executedBy`);
    assert(decision.executedBy === null, "N01_DECISION_EXECUTION_FORBIDDEN", `${path}.executedBy must remain null`);
    assert(AUTHORITY_OUTCOMES.includes(decision.outcome), "N01_AUTHORITY_OUTCOME_INVALID", `${path}.outcome is invalid`);
    assert(Number.isInteger(decision.expectedVersion) && decision.expectedVersion >= 0, "N01_EXPECTED_VERSION_INVALID", `${path}.expectedVersion must be a non-negative integer`);
    assert(decision.effectMode === "MOCK_ONLY", "N01_EFFECT_MODE_INVALID", `${path}.effectMode must be MOCK_ONLY`);
    if (catalogSensitivity === "SENSITIVE") assert(decision.outcome !== "AUTO_ELIGIBLE", "N01_SENSITIVE_AUTO_FORBIDDEN", "sensitive actions cannot be auto eligible");
    if (decision.outcome === "APPROVED") assert(decision.approvedBy?.actorKind === "HUMAN", "N01_HUMAN_APPROVAL_REQUIRED", "APPROVED requires a human approver");
    if (["AUTO_ELIGIBLE", "REQUIRE_APPROVAL", "DENIED"].includes(decision.outcome)) assert(decision.approvedBy === null, "N01_APPROVER_FORBIDDEN", `${decision.outcome} cannot include approvedBy`);
  }

  function validateStateTransition(transition, path) {
    exactObject(transition, ["contractVersion", "transitionId", "entityKind", "entityRef", "fromState", "toState", "transitionClass", "trigger", "actor", "evidenceRefs", "expectedVersion", "authorityDecisionRef", "effectMode"], path);
    assert(transition.contractVersion === "state-transition.v1", "N01_TRANSITION_VERSION_INVALID", `${path}.contractVersion is invalid`);
    safeIdentifier(transition.transitionId, `${path}.transitionId`);
    assert(ENTITY_KINDS.includes(transition.entityKind), "N01_ENTITY_KIND_INVALID", `${path}.entityKind is invalid`);
    localRef(transition.entityRef, `${path}.entityRef`);
    nonEmpty(transition.fromState, `${path}.fromState`);
    nonEmpty(transition.toState, `${path}.toState`);
    assert(TRANSITION_CLASSES.includes(transition.transitionClass), "N01_TRANSITION_CLASS_INVALID", `${path}.transitionClass is invalid`);
    nonEmpty(transition.trigger, `${path}.trigger`);
    validateActor(transition.actor, `${path}.actor`);
    localRefArray(transition.evidenceRefs, `${path}.evidenceRefs`, { allowEmpty: true });
    assert(Number.isInteger(transition.expectedVersion) && transition.expectedVersion >= 0, "N01_EXPECTED_VERSION_INVALID", `${path}.expectedVersion must be a non-negative integer`);
    if (transition.authorityDecisionRef !== null) localRef(transition.authorityDecisionRef, `${path}.authorityDecisionRef`);
    assert(transition.effectMode === "MOCK_ONLY", "N01_EFFECT_MODE_INVALID", `${path}.effectMode must be MOCK_ONLY`);
    if (transition.entityKind === "Case" && transition.trigger === "RESPONSE_DETECTED") {
      assert(!["RESOLUTION", "CLOSURE"].includes(transition.transitionClass), "N01_RESPONSE_CANNOT_CLOSE", "a detected response cannot resolve or close a case");
    }
  }

  function validateDraftPayload(payload, path) {
    exactObject(payload, ["world", "truthLabel", "payloadRef", "actionType", "subjectRef", "body"], path);
    assert(payload.world === "TOTALLY_FICTITIOUS", "N01_REAL_DATA_FORBIDDEN", `${path}.world must be TOTALLY_FICTITIOUS`);
    assert(payload.truthLabel === "DATO_FICTICIO", "N01_TRUTH_LABEL_INVALID", `${path}.truthLabel must be DATO_FICTICIO`);
    localRef(payload.payloadRef, `${path}.payloadRef`);
    localRef(payload.subjectRef, `${path}.subjectRef`);
    nonEmpty(payload.actionType, `${path}.actionType`);
    nonEmpty(payload.body, `${path}.body`);
  }

  function validateWhatsAppDraftPayload(payload, path) {
    exactObject(payload, ["world", "truthLabel", "payloadRef", "actionType", "subjectRef", "recipientRef", "body"], path);
    assert(payload.world === "TOTALLY_FICTITIOUS", "N01_REAL_DATA_FORBIDDEN", `${path}.world must be TOTALLY_FICTITIOUS`);
    assert(payload.truthLabel === "DATO_FICTICIO", "N01_TRUTH_LABEL_INVALID", `${path}.truthLabel must be DATO_FICTICIO`);
    localRef(payload.payloadRef, `${path}.payloadRef`);
    localRef(payload.subjectRef, `${path}.subjectRef`);
    localRef(payload.recipientRef, `${path}.recipientRef`);
    nonEmpty(payload.actionType, `${path}.actionType`);
    nonEmpty(payload.body, `${path}.body`);
  }

  function validatePayload(command) {
    const { workflowCode, payload } = command;
    exactObject(payload, PAYLOAD_KEYS[workflowCode], "command.payload");
    if (workflowCode === "PE01") {
      localRef(payload.itemRef, "command.payload.itemRef");
    } else if (workflowCode === "PE02") {
      localRef(payload.subjectRef, "command.payload.subjectRef");
      localRef(payload.policyBundleRef, "command.payload.policyBundleRef");
      exactObject(payload.actionRequest, ["actionType", "proposedBy", "expectedVersion"], "command.payload.actionRequest");
      nonEmpty(payload.actionRequest.actionType, "command.payload.actionRequest.actionType");
      assert([...SENSITIVE_ACTIONS, ...NON_SENSITIVE_ACTIONS].includes(payload.actionRequest.actionType), "N01_ACTION_TYPE_UNKNOWN", "actionRequest.actionType is not catalogued");
      validateActor(payload.actionRequest.proposedBy, "command.payload.actionRequest.proposedBy");
      assert(Number.isInteger(payload.actionRequest.expectedVersion) && payload.actionRequest.expectedVersion >= 0, "N01_EXPECTED_VERSION_INVALID", "expectedVersion must be a non-negative integer");
    } else if (workflowCode === "PE03") {
      safeIdentifier(payload.draftId, "command.payload.draftId");
      assert(Number.isInteger(payload.revision) && payload.revision > 0, "N01_REVISION_INVALID", "revision must be a positive integer");
      validateDraftPayload(payload.payload, "command.payload.payload");
      validateAuthorityDecision(payload.decision, "command.payload.decision");
      assert(payload.payload.actionType === payload.decision.action.actionType, "N01_DRAFT_DECISION_MISMATCH", "draft actionType must match the authority decision");
      assert(payload.payload.subjectRef === payload.decision.action.subjectRef, "N01_DRAFT_SUBJECT_MISMATCH", "draft subjectRef must match the authority decision");
    } else if (workflowCode === "PE04") {
      localRef(payload.assignmentRef, "command.payload.assignmentRef");
      safeIdentifier(payload.eventId, "command.payload.eventId");
      validateStateTransition(payload.transition, "command.payload.transition");
      assert(payload.transition.entityKind === "Assignment", "N01_ASSIGNMENT_KIND_REQUIRED", "PE04 requires an Assignment transition");
      assert(payload.transition.entityRef === payload.assignmentRef, "N01_ASSIGNMENT_REF_MUTATED", "PE04 assignmentRef must match the transition");
      assert(["OBSERVATION", "PROGRESS"].includes(payload.transition.transitionClass), "N01_ASSIGNMENT_CLASS_INVALID", "PE04 cannot verify, resolve or close");
      assert(["ASSIGNMENT_ACCEPTED", "ASSIGNMENT_REJECTED", "ASSIGNMENT_RETURNED"].includes(payload.transition.trigger), "N01_ASSIGNMENT_TRIGGER_INVALID", "PE04 trigger is not allowed");
    } else if (workflowCode === "PE05") {
      localRef(payload.conversationRef, "command.payload.conversationRef");
      localRef(payload.messageRef, "command.payload.messageRef");
      safeIdentifier(payload.eventId, "command.payload.eventId");
      validateStateTransition(payload.transition, "command.payload.transition");
      assert(payload.transition.trigger === "RESPONSE_DETECTED", "N01_RESPONSE_TRIGGER_REQUIRED", "PE05 requires RESPONSE_DETECTED");
      assert(payload.transition.transitionClass === "OBSERVATION", "N01_RESPONSE_CLASS_INVALID", "PE05 must remain an observation");
      assert(payload.transition.toState === "RESPONDIDO_PENDIENTE_VERIFICACION", "N01_RESPONSE_STATE_INVALID", "PE05 must remain pending verification");
    } else if (workflowCode === "PE06") {
      localRef(payload.clockRef, "command.payload.clockRef");
      timestamp(payload.observedAt, "command.payload.observedAt");
      localRef(payload.subjectRef, "command.payload.subjectRef");
      assert(OBSERVATION_KINDS.includes(payload.observationKind), "N01_OBSERVATION_KIND_INVALID", "observationKind is not allowed");
      localRefArray(payload.ruleRefs, "command.payload.ruleRefs");
      assert(command.occurredAt === payload.observedAt, "N01_CLOCK_TIME_CONFLICT", "PE06 envelope and observation clocks must match");
    } else if (workflowCode === "PE07") {
      safeIdentifier(payload.draftId, "command.payload.draftId");
      assert(Number.isInteger(payload.revision) && payload.revision > 0, "N01_REVISION_INVALID", "revision must be a positive integer");
      validateWhatsAppDraftPayload(payload.payload, "command.payload.payload");
      validateAuthorityDecision(payload.decision, "command.payload.decision");
      assert(payload.payload.actionType === payload.decision.action.actionType, "N01_DRAFT_DECISION_MISMATCH", "brief actionType must match the authority decision");
      assert(payload.payload.subjectRef === payload.decision.action.subjectRef, "N01_DRAFT_SUBJECT_MISMATCH", "brief subjectRef must match the authority decision");
    } else if (workflowCode === "PE08") {
      assert(WHATSAPP_COMMANDS.includes(payload.commandCode), "N01_WHATSAPP_COMMAND_UNKNOWN", "commandCode is not catalogued");
      nonEmpty(payload.commandText, "command.payload.commandText");
      localRef(payload.subjectRef, "command.payload.subjectRef");
      validateActor(payload.actor, "command.payload.actor");
      assert(payload.actor.actorKind === "HUMAN", "N01_WHATSAPP_ACTOR_INVALID", "PE08 requires a fictitious human actor");
    } else if (workflowCode === "PE09") {
      localRef(payload.itemRef, "command.payload.itemRef");
      localRef(payload.caseRef, "command.payload.caseRef");
      localRefArray(payload.conversationRefs, "command.payload.conversationRefs");
    } else if (workflowCode === "PE10") {
      safeIdentifier(payload.deliveryIdempotencyKey, "command.payload.deliveryIdempotencyKey");
      localRef(payload.deliveryRef, "command.payload.deliveryRef");
      timestamp(payload.observedAt, "command.payload.observedAt");
      assert(command.occurredAt === payload.observedAt, "N01_CLOCK_TIME_CONFLICT", "PE10 envelope and observation clocks must match");
    } else if (workflowCode === "PE11") {
      timestamp(payload.observedAt, "command.payload.observedAt");
      localRefArray(payload.requiredSourceRefs, "command.payload.requiredSourceRefs");
      assert(command.occurredAt === payload.observedAt, "N01_CLOCK_TIME_CONFLICT", "PE11 envelope and observation clocks must match");
    } else if (workflowCode === "PE12") {
      safeIdentifier(payload.eventId, "command.payload.eventId");
      validateStateTransition(payload.transition, "command.payload.transition");
      assert(payload.transition.entityKind === "Case", "N01_VERIFICATION_CASE_REQUIRED", "PE12 only governs Case transitions");
      assert(["VERIFICATION", "RESOLUTION", "CLOSURE", "REOPEN"].includes(payload.transition.transitionClass), "N01_VERIFICATION_CLASS_INVALID", "PE12 requires a verification/closure lifecycle transition");
      assert(["HUMAN_VERIFIED", "HUMAN_RESOLVED", "HUMAN_VERIFICATION", "EVIDENCE_CONTRADICTED"].includes(payload.transition.trigger), "N01_VERIFICATION_TRIGGER_INVALID", "PE12 trigger is not allowed");
      assert(payload.transition.actor.actorKind === "HUMAN", "N01_VERIFICATION_HUMAN_REQUIRED", "PE12 requires a fictitious human actor");
      assert(payload.transition.evidenceRefs.length > 0, "N01_VERIFICATION_EVIDENCE_REQUIRED", "PE12 requires local evidence references");
    }
  }

  function validateCommand(command, expectedWorkflowCode = null) {
    exactObject(command, COMMAND_KEYS, "command");
    assert(command.contractVersion === COMMAND_VERSION_VALUE, "N01_COMMAND_VERSION_INVALID", `contractVersion must be ${COMMAND_VERSION_VALUE}`);
    assert(WORKFLOW_CODE_VALUES.includes(command.workflowCode), "N01_WORKFLOW_CODE_INVALID", "workflowCode is not activated", { workflowCode: command.workflowCode });
    if (expectedWorkflowCode !== null) assert(command.workflowCode === expectedWorkflowCode, "N01_WORKFLOW_CODE_MISMATCH", `expected ${expectedWorkflowCode}`);
    for (const key of ["requestId", "correlationId", "idempotencyKey"]) safeIdentifier(command[key], `command.${key}`);
    timestamp(command.occurredAt, "command.occurredAt");
    validatePayload(command);
    return clone(command);
  }

  function validateRetry(retry, result) {
    exactObject(retry, ["attempt", "maxAttempts", "retryable", "reason", "nextAttemptAt"], "result.retry");
    assert(Number.isInteger(retry.attempt) && retry.attempt > 0, "N01_RETRY_ATTEMPT_INVALID", "retry.attempt must be positive");
    assert(retry.maxAttempts === 3 && retry.attempt <= retry.maxAttempts, "N01_RETRY_LIMIT_INVALID", "retry limits are invalid");
    assert(typeof retry.retryable === "boolean", "N01_RETRYABLE_INVALID", "retry.retryable must be boolean");
    assert(RETRY_REASONS.includes(retry.reason), "N01_RETRY_REASON_INVALID", "retry.reason is invalid");
    assert(retry.nextAttemptAt === null || isRfc3339(retry.nextAttemptAt), "N01_NEXT_ATTEMPT_INVALID", "nextAttemptAt must be null or RFC 3339");
    assert(result.outcome === "FAILED_CLOSED" || retry.retryable === false, "N01_RETRY_OUTCOME_CONFLICT", "only FAILED_CLOSED can be retryable");
    if (retry.retryable) {
      assert(retry.reason === "CONTROLLED_LOCAL_DEPENDENCY_FAILURE", "N01_RETRY_REASON_CONFLICT", "retryable failures require the dependency reason");
      assert(retry.attempt < retry.maxAttempts, "N01_RETRY_EXHAUSTED", "an exhausted attempt cannot remain retryable");
    }
    if (result.outcome === "FAILED_CLOSED" && !retry.retryable) assert(retry.reason === "FAILED_CLOSED", "N01_RETRY_REASON_CONFLICT", "non-retryable failures require FAILED_CLOSED reason");
    if (result.outcome !== "FAILED_CLOSED") assert(!["FAILED_CLOSED", "CONTROLLED_LOCAL_DEPENDENCY_FAILURE"].includes(retry.reason), "N01_RETRY_REASON_CONFLICT", "successful results cannot claim a failure retry reason");
    if (result.outcome === "DUPLICATE_SUPPRESSED") assert(retry.reason === "IDEMPOTENT_REPLAY", "N01_RETRY_REASON_CONFLICT", "duplicates require IDEMPOTENT_REPLAY reason");
    if (!["FAILED_CLOSED", "DUPLICATE_SUPPRESSED"].includes(result.outcome)) {
      const expectedReason = retry.attempt > 1 ? "COMPLETED_AFTER_RETRY" : "COMPLETED";
      assert(retry.reason === expectedReason, "N01_RETRY_REASON_CONFLICT", `attempt ${retry.attempt} requires ${expectedReason}`);
    }
    if (!retry.retryable) assert(retry.nextAttemptAt === null, "N01_RETRY_SCHEDULE_FORBIDDEN", "non-retryable results cannot schedule another attempt");
  }

  function validateCoverage(coverage) {
    exactObject(coverage, ["status", "requiredSourceRefs", "missingSourceRefs", "calmPermitted"], "result.coverage");
    assert(COVERAGE_STATUSES.includes(coverage.status), "N01_COVERAGE_STATUS_INVALID", "coverage status is invalid");
    localRefArray(coverage.requiredSourceRefs, "result.coverage.requiredSourceRefs", { allowEmpty: true });
    localRefArray(coverage.missingSourceRefs, "result.coverage.missingSourceRefs", { allowEmpty: true });
    assert(coverage.missingSourceRefs.every((ref) => coverage.requiredSourceRefs.includes(ref)), "N01_COVERAGE_MISSING_UNKNOWN", "missing sources must be required sources");
    assert(typeof coverage.calmPermitted === "boolean", "N01_CALM_FLAG_INVALID", "coverage.calmPermitted must be boolean");
    assert(coverage.status !== "COMPLETE" || coverage.missingSourceRefs.length === 0, "N01_COMPLETE_COVERAGE_MISSING", "COMPLETE coverage cannot declare missing sources");
    assert(coverage.status === "COMPLETE" || coverage.calmPermitted === false, "N01_FALSE_CALM_FORBIDDEN", "incomplete coverage cannot permit calm");
    assert(!coverage.calmPermitted || coverage.missingSourceRefs.length === 0, "N01_FALSE_CALM_FORBIDDEN", "calm requires no missing source");
  }

  function validateErrors(errors, result) {
    assert(Array.isArray(errors), "N01_ERRORS_INVALID", "errors must be an array");
    for (const [index, error] of errors.entries()) {
      const path = `result.errors[${index}]`;
      exactObject(error, ["code", "category", "message", "retryable", "source", "detailsRef"], path);
      for (const key of ["code", "message"]) nonEmpty(error[key], `${path}.${key}`);
      nonEmpty(error.source, `${path}.source`);
      assert(/^[a-z0-9][a-z0-9._-]*$/i.test(error.source), "N01_ERROR_SOURCE_INVALID", `${path}.source must be a local identifier without a URI scheme`);
      assert(ERROR_CATEGORIES.includes(error.category), "N01_ERROR_CATEGORY_INVALID", `${path}.category is invalid`);
      assert(typeof error.retryable === "boolean", "N01_ERROR_RETRYABLE_INVALID", `${path}.retryable must be boolean`);
      assert(error.retryable === result.retry.retryable, "N01_ERROR_RETRY_CONFLICT", `${path}.retryable contradicts result.retry`);
      localRef(error.detailsRef, `${path}.detailsRef`);
    }
    assert(result.outcome !== "FAILED_CLOSED" || errors.length > 0, "N01_FAIL_CLOSED_ERROR_REQUIRED", "FAILED_CLOSED requires a structured error");
    assert(result.outcome === "FAILED_CLOSED" || errors.length === 0, "N01_SUCCESS_ERROR_FORBIDDEN", "non-failed results cannot hide errors");
  }

  function validateEmptyOutput(workflowCode, refs) {
    const expected = EMPTY_OUTPUTS[workflowCode];
    assert(Object.keys(expected).every((key) => JSON.stringify(refs[key]) === JSON.stringify(expected[key])), "N01_FAILED_OUTPUT_NOT_EMPTY", "FAILED_CLOSED must use the exact empty outputRefs");
  }

  function validatePe01Output(result, command) {
    const refs = result.outputRefs;
    if (result.outcome === "FAILED_CLOSED") return validateEmptyOutput("PE01", refs);
    localRef(refs.itemRef, "result.outputRefs.itemRef");
    safeIdentifier(refs.claimId, "result.outputRefs.claimId");
    safeIdentifier(refs.inferenceId, "result.outputRefs.inferenceId");
    identifierArray(refs.eventIds, "result.outputRefs.eventIds");
    if (command) assert(refs.itemRef === command.payload.itemRef, "N01_ITEM_REF_MUTATED", "PE01 itemRef changed");
  }

  function validatePe02Output(result, command) {
    const refs = result.outputRefs;
    if (result.outcome === "FAILED_CLOSED") return validateEmptyOutput("PE02", refs);
    validateAuthorityDecision(refs.decision, "result.outputRefs.decision");
    localRef(refs.appliedRuleRef, "result.outputRefs.appliedRuleRef");
    safeIdentifier(refs.replayHash, "result.outputRefs.replayHash");
    localRefArray(refs.attentionRefs, "result.outputRefs.attentionRefs", { allowEmpty: true });
    if (result.outcome !== "DUPLICATE_SUPPRESSED") assert(result.outcome === refs.decision.outcome, "N01_DECISION_OUTCOME_CONFLICT", "PE02 outcome contradicts its authority decision");
    if (refs.decision.outcome === "REQUIRE_APPROVAL") assert(refs.attentionRefs.length > 0, "N01_APPROVAL_ATTENTION_REQUIRED", "REQUIRE_APPROVAL must remain visible");
    if (command) {
      assert(refs.decision.action.actionType === command.payload.actionRequest.actionType, "N01_DECISION_ACTION_MUTATED", "PE02 decision actionType changed");
      assert(refs.decision.action.subjectRef === command.payload.subjectRef, "N01_DECISION_SUBJECT_MUTATED", "PE02 decision subjectRef changed");
      assert(refs.decision.expectedVersion === command.payload.actionRequest.expectedVersion, "N01_DECISION_VERSION_MUTATED", "PE02 decision expectedVersion changed");
      assert(JSON.stringify(refs.decision.proposedBy) === JSON.stringify(command.payload.actionRequest.proposedBy), "N01_DECISION_PROPOSER_MUTATED", "PE02 decision proposedBy changed");
    }
  }

  function validatePe03Output(result, command) {
    const refs = result.outputRefs;
    if (result.outcome === "FAILED_CLOSED") return validateEmptyOutput("PE03", refs);
    safeIdentifier(refs.draftIdentity, "result.outputRefs.draftIdentity");
    nullableIdentifier(refs.effectId, "result.outputRefs.effectId");
    if (["HELD_FOR_APPROVAL", "DENIED", "PREPARED"].includes(result.outcome)) assert(refs.effectId === null, "N01_EFFECT_ID_FORBIDDEN", `${result.outcome} cannot have an effectId`);
    if (result.outcome === "SIMULATED") assert(refs.effectId !== null, "N01_EFFECT_ID_REQUIRED", "SIMULATED requires an effectId");
    if (command) {
      assert(refs.draftIdentity === `${command.payload.draftId}@${command.payload.revision}`, "N01_DRAFT_IDENTITY_MUTATED", "PE03 draft identity changed");
      const authority = command.payload.decision.outcome;
      if (authority === "REQUIRE_APPROVAL") assert(["HELD_FOR_APPROVAL", "DUPLICATE_SUPPRESSED"].includes(result.outcome) && refs.effectId === null, "N01_AUTHORITY_ROUTE_CONFLICT", "REQUIRE_APPROVAL must be held without an effect");
      if (authority === "DENIED") assert(["DENIED", "DUPLICATE_SUPPRESSED"].includes(result.outcome) && refs.effectId === null, "N01_AUTHORITY_ROUTE_CONFLICT", "DENIED must not execute");
      if (["AUTO_ELIGIBLE", "APPROVED"].includes(authority)) assert(["PREPARED", "SIMULATED", "DUPLICATE_SUPPRESSED"].includes(result.outcome), "N01_AUTHORITY_ROUTE_CONFLICT", "authorized decisions must use an allowed delivery route");
      if (["AUTO_ELIGIBLE", "APPROVED"].includes(authority) && result.outcome === "DUPLICATE_SUPPRESSED") assert(refs.effectId !== null, "N01_EFFECT_ID_REQUIRED", "authorized duplicate requires the existing simulated effectId");
    }
  }

  function validatePe04Output(result, command) {
    const refs = result.outputRefs;
    if (result.outcome === "FAILED_CLOSED") return validateEmptyOutput("PE04", refs);
    safeIdentifier(refs.eventId, "result.outputRefs.eventId");
    localRef(refs.assignmentRef, "result.outputRefs.assignmentRef");
    nonEmpty(refs.state, "result.outputRefs.state");
    assert(typeof refs.returned === "boolean" && refs.closed === false, "N01_ASSIGNMENT_CLOSURE_FORBIDDEN", "PE04 cannot close an assignment as a business case");
    if (result.outcome === "ASSIGNMENT_RETURNED") assert(refs.returned === true, "N01_ASSIGNMENT_RETURN_FLAG_REQUIRED", "returned outcome requires returned=true");
    if (result.outcome === "ASSIGNMENT_RECORDED") assert(refs.returned === false, "N01_ASSIGNMENT_RETURN_FLAG_FORBIDDEN", "recorded assignment cannot claim return");
    if (command) {
      assert(refs.eventId === command.payload.eventId, "N01_EVENT_ID_MUTATED", "PE04 eventId changed");
      assert(refs.assignmentRef === command.payload.assignmentRef, "N01_ASSIGNMENT_REF_MUTATED", "PE04 assignmentRef changed");
      assert(refs.state === command.payload.transition.toState, "N01_ASSIGNMENT_STATE_MUTATED", "PE04 state changed");
    }
  }

  function validatePe05Output(result, command) {
    const refs = result.outputRefs;
    if (result.outcome === "FAILED_CLOSED") return validateEmptyOutput("PE05", refs);
    safeIdentifier(refs.eventId, "result.outputRefs.eventId");
    localRef(refs.entityRef, "result.outputRefs.entityRef");
    assert(refs.state === "RESPONDIDO_PENDIENTE_VERIFICACION", "N01_RESPONSE_STATE_INVALID", "PE05 output must remain pending verification");
    assert(refs.resolved === false && refs.closed === false, "N01_RESPONSE_CANNOT_CLOSE", "PE05 cannot resolve or close");
    if (command) {
      assert(refs.eventId === command.payload.eventId, "N01_EVENT_ID_MUTATED", "PE05 eventId changed");
      assert(refs.entityRef === command.payload.transition.entityRef, "N01_ENTITY_REF_MUTATED", "PE05 entityRef changed");
    }
  }

  function validateAttention(attention, outcome, subjectRefs) {
    if (attention === null) {
      assert(["NO_ACTION", "DUPLICATE_SUPPRESSED"].includes(outcome), "N01_CLOCK_ATTENTION_REQUIRED", `${outcome} requires attention`);
      return;
    }
    exactObject(attention, ["attentionRef", "attentionCode", "subjectRef", "experimental"], "result.outputRefs.attention");
    localRef(attention.attentionRef, "result.outputRefs.attention.attentionRef");
    localRef(attention.subjectRef, "result.outputRefs.attention.subjectRef");
    assert(subjectRefs.includes(attention.subjectRef), "N01_CLOCK_ATTENTION_SUBJECT_INVALID", "attention subject must be evaluated");
    assert(attention.experimental === true, "N01_CLOCK_ATTENTION_NOT_EXPERIMENTAL", "clock attention must remain experimental");
    const allowedCodes = {
      DUE_WINDOW_VISIBLE: "EXPERIMENTAL_DUE_WINDOW",
      DUE_BREACH_VISIBLE: "EXPERIMENTAL_DUE_BREACH"
    };
    if (outcome !== "DUPLICATE_SUPPRESSED") assert(attention.attentionCode === allowedCodes[outcome], "N01_CLOCK_ATTENTION_CODE_INVALID", "attention code contradicts outcome");
    else assert(Object.values(allowedCodes).includes(attention.attentionCode), "N01_CLOCK_ATTENTION_CODE_INVALID", "duplicate attention code is invalid");
  }

  function validatePe06Output(result, command) {
    const refs = result.outputRefs;
    if (result.outcome === "FAILED_CLOSED") return validateEmptyOutput("PE06", refs);
    identifierArray(refs.eventIds, "result.outputRefs.eventIds");
    localRefArray(refs.subjectRefs, "result.outputRefs.subjectRefs");
    assert(refs.nextCheckAt === null, "N01_NEXT_CHECK_INVENTED", "PE06 cannot invent nextCheckAt in this phase");
    assert(refs.transition === null, "N01_CLOCK_TRANSITION_INVENTED", "PE06 cannot invent a transition in this phase");
    localRefArray(refs.appliedRuleRefs, "result.outputRefs.appliedRuleRefs");
    validateAttention(refs.attention, result.outcome, refs.subjectRefs);
    if (command) {
      assert(refs.subjectRefs.includes(command.payload.subjectRef), "N01_CLOCK_SUBJECT_MUTATED", "PE06 subjectRef changed");
      assert(JSON.stringify([...refs.appliedRuleRefs].sort()) === JSON.stringify([...command.payload.ruleRefs].sort()), "N01_CLOCK_RULES_MUTATED", "PE06 applied rules changed");
    }
  }

  function validatePe07Output(result, command) {
    const refs = result.outputRefs;
    if (result.outcome === "FAILED_CLOSED") return validateEmptyOutput("PE07", refs);
    safeIdentifier(refs.draftIdentity, "result.outputRefs.draftIdentity");
    nullableIdentifier(refs.effectId, "result.outputRefs.effectId");
    localRef(refs.recipientRef, "result.outputRefs.recipientRef");
    if (["HELD_FOR_APPROVAL", "DENIED", "PREPARED"].includes(result.outcome)) assert(refs.effectId === null, "N01_EFFECT_ID_FORBIDDEN", `${result.outcome} cannot have an effectId`);
    if (["SIMULATED", "DUPLICATE_SUPPRESSED"].includes(result.outcome) && command?.payload.decision.outcome !== "REQUIRE_APPROVAL" && command?.payload.decision.outcome !== "DENIED") assert(refs.effectId !== null, "N01_EFFECT_ID_REQUIRED", "authorized WhatsApp delivery requires an effectId");
    if (command) {
      assert(refs.draftIdentity === `${command.payload.draftId}@${command.payload.revision}`, "N01_DRAFT_IDENTITY_MUTATED", "PE07 draft identity changed");
      assert(refs.recipientRef === command.payload.payload.recipientRef, "N01_WHATSAPP_RECIPIENT_MUTATED", "PE07 recipientRef changed");
      if (command.payload.decision.outcome === "REQUIRE_APPROVAL") assert(["HELD_FOR_APPROVAL", "DUPLICATE_SUPPRESSED"].includes(result.outcome) && refs.effectId === null, "N01_AUTHORITY_ROUTE_CONFLICT", "REQUIRE_APPROVAL must be held");
      if (command.payload.decision.outcome === "DENIED") assert(["DENIED", "DUPLICATE_SUPPRESSED"].includes(result.outcome) && refs.effectId === null, "N01_AUTHORITY_ROUTE_CONFLICT", "DENIED must not deliver");
    }
  }

  function validatePe08Output(result, command) {
    const refs = result.outputRefs;
    if (result.outcome === "FAILED_CLOSED") return validateEmptyOutput("PE08", refs);
    localRef(refs.uiRef, "result.outputRefs.uiRef");
    assert(refs.authorityGranted === false && refs.stateChanged === false, "N01_WHATSAPP_AUTHORITY_FORBIDDEN", "WhatsApp commands cannot grant authority or change state");
    safeIdentifier(refs.effectId, "result.outputRefs.effectId");
    if (command) assert(refs.uiRef.includes(encodeURIComponent(command.payload.subjectRef)), "N01_WHATSAPP_UI_REF_MUTATED", "PE08 UI ref must point to the subject");
  }

  function validatePe09Output(result, command) {
    const refs = result.outputRefs;
    if (result.outcome === "FAILED_CLOSED") return validateEmptyOutput("PE09", refs);
    localRef(refs.itemRef, "result.outputRefs.itemRef");
    localRef(refs.caseRef, "result.outputRefs.caseRef");
    localRefArray(refs.conversationRefs, "result.outputRefs.conversationRefs");
    assert(COVERAGE_STATUSES.includes(refs.coverageStatus), "N01_COVERAGE_STATUS_INVALID", "PE09 coverageStatus is invalid");
    nonEmpty(refs.state, "result.outputRefs.state");
    if (command) {
      assert(refs.itemRef === command.payload.itemRef && refs.caseRef === command.payload.caseRef, "N01_CASE_REF_MUTATED", "PE09 case identity changed");
      assert(JSON.stringify([...refs.conversationRefs].sort()) === JSON.stringify([...command.payload.conversationRefs].sort()), "N01_CASE_CONVERSATIONS_MUTATED", "PE09 conversation refs changed");
    }
  }

  function validatePe10Output(result, command) {
    const refs = result.outputRefs;
    if (result.outcome === "FAILED_CLOSED") return validateEmptyOutput("PE10", refs);
    localRef(refs.deliveryRef, "result.outputRefs.deliveryRef");
    assert(refs.status === "COMPLETED", "N01_DELIVERY_STATUS_INVALID", "PE10 only confirms a completed durable delivery");
    safeIdentifier(refs.effectId, "result.outputRefs.effectId");
    identifierArray(refs.discrepancyCodes, "result.outputRefs.discrepancyCodes", { allowEmpty: true });
    if (command) assert(refs.deliveryRef === command.payload.deliveryRef, "N01_DELIVERY_REF_MUTATED", "PE10 deliveryRef changed");
  }

  function validatePe11Output(result, command) {
    const refs = result.outputRefs;
    if (result.outcome === "FAILED_CLOSED") return validateEmptyOutput("PE11", refs);
    assert(COVERAGE_STATUSES.includes(refs.coverageStatus), "N01_COVERAGE_STATUS_INVALID", "PE11 coverageStatus is invalid");
    assert(typeof refs.calmPermitted === "boolean", "N01_CALM_FLAG_INVALID", "PE11 calmPermitted must be boolean");
    identifierArray(refs.discrepancyCodes, "result.outputRefs.discrepancyCodes", { allowEmpty: true });
    identifierArray(refs.actions, "result.outputRefs.actions", { allowEmpty: true });
    safeIdentifier(refs.replayHash, "result.outputRefs.replayHash");
    assert(refs.coverageStatus === result.coverage.status && refs.calmPermitted === result.coverage.calmPermitted, "N01_COVERAGE_RESULT_CONFLICT", "PE11 outputRefs contradict result.coverage");
    assert(refs.discrepancyCodes.length === refs.actions.length, "N01_DISCREPANCY_ACTION_MISMATCH", "PE11 discrepancies and actions must correspond");
    if (result.outcome === "COVERAGE_COMPLETE") assert(refs.coverageStatus === "COMPLETE", "N01_COVERAGE_OUTCOME_CONFLICT", "COVERAGE_COMPLETE requires COMPLETE coverage");
    if (result.outcome === "COVERAGE_DEGRADED_VISIBLE") assert(refs.coverageStatus !== "COMPLETE" && refs.calmPermitted === false, "N01_COVERAGE_OUTCOME_CONFLICT", "degraded coverage cannot permit calm");
    if (command) assert(JSON.stringify([...result.coverage.requiredSourceRefs].sort()) === JSON.stringify([...command.payload.requiredSourceRefs].sort()), "N01_REQUIRED_SOURCES_MUTATED", "PE11 required sources changed");
  }

  function validatePe12Output(result, command) {
    const refs = result.outputRefs;
    if (result.outcome === "FAILED_CLOSED") return validateEmptyOutput("PE12", refs);
    safeIdentifier(refs.eventId, "result.outputRefs.eventId");
    localRef(refs.entityRef, "result.outputRefs.entityRef");
    nonEmpty(refs.state, "result.outputRefs.state");
    for (const field of ["verified", "resolved", "closed", "reopened"]) assert(typeof refs[field] === "boolean", "N01_LIFECYCLE_FLAG_INVALID", `${field} must be boolean`);
    if (result.outcome === "VERIFIED") assert(refs.verified && !refs.resolved && !refs.closed && !refs.reopened, "N01_LIFECYCLE_OUTCOME_CONFLICT", "VERIFIED flags conflict");
    if (result.outcome === "RESOLVED") assert(refs.verified && refs.resolved && !refs.closed && !refs.reopened, "N01_LIFECYCLE_OUTCOME_CONFLICT", "RESOLVED flags conflict");
    if (result.outcome === "CLOSED") assert(refs.verified && refs.resolved && refs.closed && !refs.reopened, "N01_LIFECYCLE_OUTCOME_CONFLICT", "CLOSED flags conflict");
    if (result.outcome === "REOPENED") assert(refs.verified && refs.resolved && !refs.closed && refs.reopened, "N01_LIFECYCLE_OUTCOME_CONFLICT", "REOPENED flags conflict");
    if (command) {
      assert(refs.eventId === command.payload.eventId, "N01_EVENT_ID_MUTATED", "PE12 eventId changed");
      assert(refs.entityRef === command.payload.transition.entityRef, "N01_ENTITY_REF_MUTATED", "PE12 entityRef changed");
      assert(refs.state === command.payload.transition.toState, "N01_LIFECYCLE_STATE_MUTATED", "PE12 state changed");
    }
  }

  function validateResult(result, command = null, expectedWorkflowCode = null) {
    exactObject(result, RESULT_KEYS, "result");
    assert(result.contractVersion === RESULT_VERSION_VALUE, "N01_RESULT_VERSION_INVALID", `contractVersion must be ${RESULT_VERSION_VALUE}`);
    assert(WORKFLOW_CODE_VALUES.includes(result.workflowCode), "N01_RESULT_WORKFLOW_INVALID", "result workflowCode is not activated");
    if (expectedWorkflowCode !== null) assert(result.workflowCode === expectedWorkflowCode, "N01_RESULT_WORKFLOW_MISMATCH", `expected ${expectedWorkflowCode}`);
    for (const key of ["requestId", "correlationId", "idempotencyKey"]) safeIdentifier(result[key], `result.${key}`);
    assert(OUTCOMES[result.workflowCode].includes(result.outcome), "N01_RESULT_OUTCOME_INVALID", `${result.outcome} is not allowed for ${result.workflowCode}`);
    exactObject(result.outputRefs, OUTPUT_KEYS[result.workflowCode], "result.outputRefs");
    validateRetry(result.retry, result);
    validateCoverage(result.coverage);
    validateErrors(result.errors, result);
    assert(result.externalEffects === 0, "N01_EXTERNAL_EFFECT_FORBIDDEN", "externalEffects must be zero");
    assert(result.networkAccess === false, "N01_NETWORK_ACCESS_FORBIDDEN", "networkAccess must be false");
    if (command !== null) {
      assert(result.workflowCode === command.workflowCode, "N01_RESULT_WORKFLOW_MISMATCH", "result workflowCode changed");
      for (const key of ["requestId", "correlationId", "idempotencyKey"]) assert(result[key] === command[key], "N01_CORRELATION_MUTATED", `result.${key} changed`, { key });
    }
    const perWorkflow = {
      PE01: validatePe01Output,
      PE02: validatePe02Output,
      PE03: validatePe03Output,
      PE04: validatePe04Output,
      PE05: validatePe05Output,
      PE06: validatePe06Output,
      PE07: validatePe07Output,
      PE08: validatePe08Output,
      PE09: validatePe09Output,
      PE10: validatePe10Output,
      PE11: validatePe11Output,
      PE12: validatePe12Output
    };
    perWorkflow[result.workflowCode](result, command);
    return clone(result);
  }

  function emptyOutputRefs(workflowCode) {
    assert(WORKFLOW_CODE_VALUES.includes(workflowCode), "N01_WORKFLOW_CODE_INVALID", "workflowCode is not activated");
    return clone(EMPTY_OUTPUTS[workflowCode]);
  }

  return Object.freeze({ validateCommand, validateResult, emptyOutputRefs });
};
const validators = createN01Validators();
const command = $input.first().json;
validators.validateCommand(command, 'PE03');
return [{ json: command }];