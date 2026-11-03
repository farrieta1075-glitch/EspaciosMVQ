"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { Area } from "@/types/area";
import type { FloorMap, Space } from "@/types/space";
import type {
  MapDateSelection,
  RecurrenceConfig,
  RecurrenceType,
} from "@/types/reservation";
import { ReservationAreaTreePicker } from "@/components/reservation/reservation-area-tree-picker";
import {
  MapDateSelector,
  type InitialMapSelection,
} from "@/components/map-date/map-date-selector";
import {
  buildReservationAreaTree,
  flattenSelectableAreaIds,
  getAreaLabel,
} from "@/lib/reservation-area-tree";
import {
  inferMonthlyRelativeFromDate,
  needsFourthVsLastPrompt,
  weekdayNameEs,
} from "@/lib/monthly-relative-recurrence";
import { defaultRecurrenceUntil } from "@/lib/recurrence-default-until";
import {
  RECURRENCE_TYPE_LABELS,
  listRecurrenceDates,
  ordinalLabelEs,
} from "@/lib/recurrence";
import { ATTENDEE_JUSTIFICATION_OPTIONS } from "@/lib/attendee-justification";
import { reservationNeedsAttendeeJustification } from "@/lib/capacity-validation";
import { formatDateDisplay, formatDateISO } from "@/lib/date-utils";
import { addMinutesToTimeHHmm } from "@/lib/date-utils";
import type { ReservationWizardConfirmed } from "@/lib/reservation-draft-storage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { EventPresetGroup } from "@/components/reservation/event-form";
import type { AreaEventPreset } from "@/types/area-event-preset";
import {
  applyAreaEventPresetToForm,
  clearEventPresetFormFields,
  currentEventDataFitsAreaPresets,
  eventNameMatchesAnyPreset,
} from "@/lib/event-preset-utils";
import {
  applyRecurrenceToNewStartDate,
  buildRecurrenceForTypeAtDate,
  cloneRecurrenceConfig,
  describeRecurrencePattern,
  getRecurrencePreviewDates,
  suggestExceptDatesAfterChange,
} from "@/lib/calendar-date-change-preview";
import { cn } from "@/lib/utils";

const DEFAULT_CONFIRMED: ReservationWizardConfirmed = {
  area: false,
  eventName: false,
  eventDescription: false,
  attendees: false,
  recurrence: false,
  scheduleCollapsed: false,
  date: false,
  time: false,
};

function ContinueButton({
  visible,
  onClick,
  label = "Continuar »",
}: {
  visible: boolean;
  onClick: () => void;
  label?: string;
}) {
  if (!visible) return null;
  return (
    <Button type="button" size="sm" className="mt-2" onClick={onClick}>
      {label}
    </Button>
  );
}

function SummaryLine({
  label,
  value,
  onClick,
  className,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium text-foreground">{value}</span>
    </>
  );
  if (!onClick) {
    return <p className={cn("text-sm", className)}>{body}</p>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-md px-1 py-0.5 text-left text-sm hover:bg-muted/60",
        className,
      )}
    >
      {body}
    </button>
  );
}

interface ReservationCreateWizardProps {
  maps: FloorMap[];
  spaces: Space[];
  areas: Area[];
  isAdmin: boolean;
  userAreaId: string | null;
  userAreaScopeIds: string[];
  initialDate?: string;
  initialMapId?: string;
  initialSpaceId?: string;
  mapSelectorKey: number;
  restoredSelection?: InitialMapSelection;
  initialWizardConfirmed?: ReservationWizardConfirmed | null;
  eventPresetGroups: EventPresetGroup[];
  presetsByAreaId: Record<string, AreaEventPreset[]>;
  eventDetailsHeaderEl?: HTMLElement | null;
  onEventDetailsDoneChange?: (done: boolean) => void;
  calendarDateChangeConfirm?: { anchorDate: string; newDate: string } | null;
  onCalendarDateChangeConfirm?: (options: {
    newDate: string;
    anchorDate: string;
    keepRecurrence: boolean;
    keepExceptions: boolean;
    exceptDates?: string[];
    recurrence?: RecurrenceConfig;
  }) => void;
  onCalendarDateChangeCancel?: () => void;
  presetSourceAreaId: string;
  onPresetSourceAreaIdChange: (id: string) => void;
  onSelectionChange: (selection: MapDateSelection) => void;
  onReservationDatePick: (ctx: {
    wizardConfirmed: ReservationWizardConfirmed;
  }) => void;
  resourcesOpen: boolean;
  onResourcesOpenChange: (open: boolean) => void;
  resourceCount: number;
  selection: MapDateSelection | null;
  onSubmit: () => void;
  canSubmit: boolean;
  loading: boolean;
  eventName: string;
  onEventNameChange: (v: string) => void;
  eventDescription: string;
  onEventDescriptionChange: (v: string) => void;
  estimatedAttendees: string;
  onEstimatedAttendeesChange: (v: string) => void;
  attendeeJustificationCode: string;
  onAttendeeJustificationCodeChange: (v: string) => void;
  attendeeJustificationNote: string;
  onAttendeeJustificationNoteChange: (v: string) => void;
  recurrence: RecurrenceConfig;
  onRecurrenceChange: (v: RecurrenceConfig) => void;
  sendEventReminder: boolean;
  onSendEventReminderChange: (v: boolean) => void;
  areaId: string;
  onAreaIdChange: (v: string) => void;
  reservationAreaId: string;
  onReservationAreaIdChange: (v: string) => void;
}

export function ReservationCreateWizard(props: ReservationCreateWizardProps) {
  const {
    maps,
    spaces,
    areas,
    isAdmin,
    userAreaScopeIds,
    userAreaId,
    initialDate,
    initialMapId,
    initialSpaceId,
    mapSelectorKey,
    restoredSelection,
    initialWizardConfirmed,
    presetsByAreaId,
    onSelectionChange,
    onReservationDatePick,
    resourcesOpen,
    onResourcesOpenChange,
    resourceCount,
    selection,
    onSubmit,
    canSubmit,
    loading,
    eventName,
    onEventNameChange,
    eventDescription,
    onEventDescriptionChange,
    estimatedAttendees,
    onEstimatedAttendeesChange,
    attendeeJustificationCode,
    onAttendeeJustificationCodeChange,
    attendeeJustificationNote,
    onAttendeeJustificationNoteChange,
    recurrence,
    onRecurrenceChange,
    sendEventReminder,
    onSendEventReminderChange,
    areaId,
    onAreaIdChange,
    reservationAreaId,
    onReservationAreaIdChange,
    eventDetailsHeaderEl,
    onEventDetailsDoneChange,
    calendarDateChangeConfirm,
    onCalendarDateChangeConfirm,
    onCalendarDateChangeCancel,
  } = props;

  const selectableIds = isAdmin
    ? areas.map((a) => a.id)
    : userAreaScopeIds.length > 0
      ? userAreaScopeIds
      : userAreaId
        ? [userAreaId]
        : [];

  const tree = buildReservationAreaTree(areas, {
    isAdmin,
    selectableAreaIds: new Set(selectableIds),
  });
  const flatSelectable = flattenSelectableAreaIds(tree);
  const showAreaPicker = isAdmin ? areas.length > 1 : flatSelectable.length > 1;
  const activeAreaId = isAdmin
    ? areaId
    : reservationAreaId || flatSelectable[0] || userAreaId || "";

  const restoreApplied = React.useRef(false);
  const [confirmed, setConfirmed] = React.useState<ReservationWizardConfirmed>(
    () => ({
      ...DEFAULT_CONFIRMED,
      area: !showAreaPicker,
      ...(initialWizardConfirmed ?? {}),
    }),
  );
  const [editingSection, setEditingSection] = React.useState<
    null | "area" | "eventName" | "eventDescription" | "attendees"
  >(null);
  const [eventDetailsExpanded, setEventDetailsExpanded] = React.useState(false);
  const [pendingAreaId, setPendingAreaId] = React.useState<string | null>(null);
  const [areaChangeDialogOpen, setAreaChangeDialogOpen] = React.useState(false);
  const [presetMismatchDialogOpen, setPresetMismatchDialogOpen] =
    React.useState(false);
  const [appliedPresetName, setAppliedPresetName] = React.useState<
    string | null
  >(null);
  const [useEventNameCombobox, setUseEventNameCombobox] = React.useState(false);
  const [manualEventNameOption, setManualEventNameOption] = React.useState<
    string | null
  >(null);
  const [showExceptionPicker, setShowExceptionPicker] = React.useState(false);
  const [confirmDialogRecurrence, setConfirmDialogRecurrence] =
    React.useState<RecurrenceConfig>(recurrence);
  const [frozenRecurrence, setFrozenRecurrence] =
    React.useState<RecurrenceConfig | null>(null);
  const [confirmDialogUntil, setConfirmDialogUntil] = React.useState("");
  const [confirmNewExceptDates, setConfirmNewExceptDates] = React.useState<
    Set<string>
  >(() => new Set());

  const MANUAL_EVENT_NAME_PREFIX = "__custom__:";

  React.useEffect(() => {
    if (!calendarDateChangeConfirm) {
      setFrozenRecurrence(null);
      return;
    }
    const frozen = cloneRecurrenceConfig(recurrence);
    setFrozenRecurrence(frozen);
    setConfirmDialogRecurrence(cloneRecurrenceConfig(recurrence));
    const until =
      recurrence.until?.trim() ||
      (recurrence.type !== "NONE" && recurrence.type !== "CUSTOM"
        ? defaultRecurrenceUntil(
            calendarDateChangeConfirm.newDate,
            recurrence.type,
          )
        : "");
    setConfirmDialogUntil(until);
    // Snapshot at dialog open only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarDateChangeConfirm]);

  const beforePreviewDates = React.useMemo(() => {
    if (!calendarDateChangeConfirm || !frozenRecurrence) return [];
    return getRecurrencePreviewDates(
      calendarDateChangeConfirm.anchorDate,
      frozenRecurrence,
    );
  }, [calendarDateChangeConfirm, frozenRecurrence]);

  const frozenExceptSet = React.useMemo(
    () => new Set(frozenRecurrence?.exceptDates ?? []),
    [frozenRecurrence],
  );

  const afterRecurrenceForPreview = React.useMemo(() => {
    if (!calendarDateChangeConfirm) return null;
    if (confirmDialogRecurrence.type === "NONE") {
      return buildRecurrenceForTypeAtDate(
        "NONE",
        calendarDateChangeConfirm.newDate,
        recurrence,
      );
    }
    const base = applyRecurrenceToNewStartDate(
      calendarDateChangeConfirm.newDate,
      {
        ...confirmDialogRecurrence,
        until: confirmDialogUntil,
      },
      calendarDateChangeConfirm.anchorDate,
    );
    if (base.type !== "NONE" && base.type !== "CUSTOM") {
      return { ...base, until: confirmDialogUntil || base.until };
    }
    return base;
  }, [
    calendarDateChangeConfirm,
    confirmDialogRecurrence,
    confirmDialogUntil,
    recurrence,
  ]);

  const afterPreviewDates = React.useMemo(() => {
    if (!calendarDateChangeConfirm || !afterRecurrenceForPreview) return [];
    if (afterRecurrenceForPreview.type === "NONE") return [];
    return getRecurrencePreviewDates(
      calendarDateChangeConfirm.newDate,
      afterRecurrenceForPreview,
    );
  }, [calendarDateChangeConfirm, afterRecurrenceForPreview]);

  const exceptSuggestKey = calendarDateChangeConfirm
    ? `${calendarDateChangeConfirm.newDate}|${confirmDialogRecurrence.type}|${confirmDialogUntil}`
    : "";

  React.useEffect(() => {
    if (
      !calendarDateChangeConfirm ||
      !frozenRecurrence ||
      !afterRecurrenceForPreview ||
      afterRecurrenceForPreview.type === "NONE"
    ) {
      setConfirmNewExceptDates(new Set());
      return;
    }
    const suggested = suggestExceptDatesAfterChange(
      calendarDateChangeConfirm.anchorDate,
      calendarDateChangeConfirm.newDate,
      frozenRecurrence,
      afterRecurrenceForPreview,
    );
    setConfirmNewExceptDates(new Set(suggested));
  }, [
    exceptSuggestKey,
    calendarDateChangeConfirm,
    frozenRecurrence,
    afterRecurrenceForPreview,
  ]);

  const presetFormHandlers = React.useMemo(
    () => ({
      onEventNameChange,
      onEventDescriptionChange,
      onEstimatedAttendeesChange,
      onRecurrenceChange,
      onSendEventReminderChange,
    }),
    [
      onEventNameChange,
      onEventDescriptionChange,
      onEstimatedAttendeesChange,
      onRecurrenceChange,
      onSendEventReminderChange,
    ],
  );

  React.useEffect(() => {
    if (restoreApplied.current || !initialWizardConfirmed) return;
    restoreApplied.current = true;
    setConfirmed((c) => ({ ...c, ...initialWizardConfirmed }));
  }, [initialWizardConfirmed]);

  React.useEffect(() => {
    if (!showAreaPicker && flatSelectable[0]) {
      if (isAdmin) onAreaIdChange(flatSelectable[0]);
      else onReservationAreaIdChange(flatSelectable[0]);
      setConfirmed((c) => ({ ...c, area: true }));
    }
  }, [
    showAreaPicker,
    flatSelectable,
    isAdmin,
    onAreaIdChange,
    onReservationAreaIdChange,
  ]);

  const presets =
    presetsByAreaId[activeAreaId] ?? presetsByAreaId[areaId] ?? [];

  const reservationDate =
    selection?.date ??
    restoredSelection?.date ??
    initialDate ??
    formatDateISO(new Date());

  const [customDateDraft, setCustomDateDraft] = React.useState("");
  const [relativeDisambiguation, setRelativeDisambiguation] = React.useState<
    "FOURTH" | "LAST" | null
  >(null);

  const [draftStart, setDraftStart] = React.useState(
    selection?.startTime ?? restoredSelection?.startTime ?? "08:00",
  );
  const [draftEnd, setDraftEnd] = React.useState(
    selection?.endTime ??
      restoredSelection?.endTime ??
      addMinutesToTimeHHmm("08:00", 60),
  );
  function syncTimeToSelection(nextStart: string, nextEnd: string) {
    onSelectionChange({
      date: reservationDate,
      startTime: nextStart,
      endTime: nextEnd,
      mapId:
        selection?.mapId ??
        restoredSelection?.mapId ??
        maps[0]?.id ??
        "",
      selectedSpaceIds: selection?.selectedSpaceIds ?? [],
      selectedResources: selection?.selectedResources ?? [],
    });
  }

  const startTime = selection?.startTime ?? draftStart;
  const endTime = selection?.endTime ?? draftEnd;

  const estimatedNumber = Number(estimatedAttendees);
  const needsJustification =
    selection &&
    reservationNeedsAttendeeJustification(
      spaces,
      selection.selectedSpaceIds,
      estimatedNumber,
    );

  const areaResolved = confirmed.area && Boolean(activeAreaId);
  const eventDetailsDone = confirmed.scheduleCollapsed;

  function canConfirmRecurrenceStep(): boolean {
    if (recurrence.type === "MONTHLY_RELATIVE") {
      if (
        needsFourthVsLastPrompt(reservationDate) &&
        !relativeDisambiguation
      ) {
        return false;
      }
      if (!recurrence.monthlyRelative) return false;
    }
    return (
      recurrence.type === "NONE" ||
      (recurrence.type === "CUSTOM" &&
        (recurrence.customDates?.length ?? 0) > 0) ||
      (recurrence.type !== "CUSTOM" && Boolean(recurrence.until))
    );
  }

  React.useEffect(() => {
    onEventDetailsDoneChange?.(eventDetailsDone);
  }, [eventDetailsDone, onEventDetailsDoneChange]);

  const activeAreaRecord =
    areas.find((a) => a.id === activeAreaId) ??
    ({
      id: activeAreaId,
      name: activeAreaId,
      code: "",
      parentId: null,
      colorHex: "",
      eventPresets: [],
    } satisfies Area);

  const areaLabel = getAreaLabel(activeAreaRecord, areas);

  function resetEventCaptureAfterAreaChange() {
    clearEventPresetFormFields(presetFormHandlers);
    setAppliedPresetName(null);
    setUseEventNameCombobox(false);
    setManualEventNameOption(null);
    setShowExceptionPicker(false);
    setEventDetailsExpanded(false);
    setConfirmed((c) => ({
      ...c,
      eventName: false,
      eventDescription: false,
      attendees: false,
      recurrence: false,
      scheduleCollapsed: false,
    }));
  }

  function applyAreaChange(id: string) {
    const newPresets = presetsForAreaId(id);
    const areaChanging = id !== activeAreaId;

    if (
      areaChanging &&
      !currentEventDataFitsAreaPresets(
        newPresets,
        eventName,
        eventDescription,
        estimatedAttendees,
        recurrence,
      )
    ) {
      resetEventCaptureAfterAreaChange();
    }

    if (isAdmin) onAreaIdChange(id);
    else onReservationAreaIdChange(id);
    if (
      !appliedPresetName &&
      eventName.trim().length >= 3 &&
      newPresets.length > 0
    ) {
      setManualEventNameOption(eventName.trim());
      setUseEventNameCombobox(true);
    }
    setConfirmed((c) => ({ ...c, area: true }));
    setEditingSection(null);
    setPendingAreaId(null);
    setAreaChangeDialogOpen(false);
  }

  function presetsForAreaId(id: string): AreaEventPreset[] {
    return presetsByAreaId[id] ?? [];
  }

  function requestAreaChange(id: string) {
    if (!id) return;
    if (id === activeAreaId) {
      setEditingSection(null);
      setPendingAreaId(null);
      setAreaChangeDialogOpen(false);
      return;
    }

    const targetPresets = presetsForAreaId(id);

    if (
      appliedPresetName &&
      !targetPresets.some((p) => p.name === appliedPresetName)
    ) {
      setPendingAreaId(id);
      setPresetMismatchDialogOpen(true);
      return;
    }

    if (
      !appliedPresetName &&
      eventNameMatchesAnyPreset(eventName, presets)
    ) {
      setPendingAreaId(id);
      setAreaChangeDialogOpen(true);
      return;
    }

    applyAreaChange(id);
  }

  function confirmPresetMismatchAreaChange() {
    resetEventCaptureAfterAreaChange();
    if (pendingAreaId) applyAreaChange(pendingAreaId);
    setPresetMismatchDialogOpen(false);
  }

  function handleEventNameComboboxChange(value: string) {
    if (value.startsWith(MANUAL_EVENT_NAME_PREFIX)) {
      const manualName = value.slice(MANUAL_EVENT_NAME_PREFIX.length);
      setAppliedPresetName(null);
      onEventNameChange(manualName);
      setManualEventNameOption(manualName);
      return;
    }
    handlePresetSelect(value);
  }

  function eventNameComboboxValue(): string {
    if (
      appliedPresetName &&
      presets.some((p) => p.name === appliedPresetName)
    ) {
      return appliedPresetName;
    }
    const trimmed = eventName.trim();
    if (
      manualEventNameOption &&
      trimmed === manualEventNameOption &&
      !presets.some((p) => p.name === manualEventNameOption)
    ) {
      return `${MANUAL_EVENT_NAME_PREFIX}${manualEventNameOption}`;
    }
    if (presets.some((p) => p.name === trimmed)) {
      return trimmed;
    }
    if (trimmed.length >= 3) {
      return `${MANUAL_EVENT_NAME_PREFIX}${trimmed}`;
    }
    return "";
  }

  function renderEventNameField(inputId: string) {
    const showCombobox = useEventNameCombobox && presets.length > 0;
    if (showCombobox) {
      const manualLabel =
        manualEventNameOption &&
        !presets.some((p) => p.name === manualEventNameOption)
          ? manualEventNameOption
          : null;
      return (
        <Select
          id={inputId}
          value={eventNameComboboxValue()}
          onChange={(e) => handleEventNameComboboxChange(e.target.value)}
        >
          <option value="" disabled>
            Selecciona o conserva tu evento
          </option>
          {manualLabel ? (
            <option value={`${MANUAL_EVENT_NAME_PREFIX}${manualLabel}`}>
              {manualLabel}
            </option>
          ) : null}
          {presets.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </Select>
      );
    }

    return (
      <>
        <Input
          id={inputId}
          value={eventName}
          onChange={(e) => {
            setAppliedPresetName(null);
            onEventNameChange(e.target.value);
          }}
          list="wiz-event-presets"
        />
        <datalist id="wiz-event-presets">
          {presets.map((p) => (
            <option key={p.name} value={p.name} />
          ))}
        </datalist>
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <Button
                key={p.name}
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => {
                  handlePresetSelect(p.name);
                  setEditingSection(null);
                }}
              >
                {p.name}
              </Button>
            ))}
          </div>
        )}
      </>
    );
  }

  function handlePresetSelect(value: string) {
    const preset = presets.find((p) => p.name === value);
    if (!preset) return;
    applyAreaEventPresetToForm(preset, reservationDate, presetFormHandlers);
    setAppliedPresetName(preset.name);
    const descOk = (preset.description ?? "").trim().length >= 3;
    const attendeesOk = Boolean(
      preset.estimatedAttendees && preset.estimatedAttendees > 0,
    );
    setConfirmed((c) => ({
      ...c,
      eventName: preset.name.trim().length >= 3,
      eventDescription: descOk,
      attendees: descOk && attendeesOk,
      scheduleCollapsed: false,
    }));
  }

  function applyMonthlyRelativeFromDate(dateIso: string) {
    if (recurrence.type !== "MONTHLY_RELATIVE") return;
    const inferred = inferMonthlyRelativeFromDate(dateIso);
    if (needsFourthVsLastPrompt(dateIso) && !relativeDisambiguation) return;
    const ordinal =
      needsFourthVsLastPrompt(dateIso) && relativeDisambiguation
        ? relativeDisambiguation
        : inferred.ordinal;
    onRecurrenceChange({
      ...recurrence,
      monthlyRelative: { weekday: inferred.weekday, ordinal },
    });
  }

  React.useEffect(() => {
    if (recurrence.type === "MONTHLY_RELATIVE") {
      applyMonthlyRelativeFromDate(reservationDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationDate, recurrence.type, relativeDisambiguation]);

  const activeHighlightAreaId = activeAreaId;

  const recurrencePreview =
    recurrence.type !== "NONE" && recurrence.type !== "CUSTOM" && confirmed.date
      ? listRecurrenceDates(
          reservationDate,
          recurrence.type,
          recurrence.until,
          recurrence,
        )
      : recurrence.type === "CUSTOM"
        ? recurrence.customDates ?? []
        : [];

  const plannedDatesForExceptions =
    recurrence.type !== "NONE" && recurrence.type !== "CUSTOM"
      ? listRecurrenceDates(
          reservationDate,
          recurrence.type,
          recurrence.until,
          recurrence,
        )
      : [];

  const exceptSet = new Set(recurrence.exceptDates ?? []);

  function handleRecurrenceTypeChange(type: RecurrenceType) {
    setShowExceptionPicker(false);
    if (type === "MONTHLY_RELATIVE") {
      setRelativeDisambiguation(null);
    }
    const until =
      type === "NONE" || type === "CUSTOM"
        ? recurrence.until
        : defaultRecurrenceUntil(reservationDate, type);

    let monthlyRelative = recurrence.monthlyRelative;
    if (type === "MONTHLY_RELATIVE") {
      const inferred = inferMonthlyRelativeFromDate(reservationDate);
      monthlyRelative = { weekday: inferred.weekday, ordinal: inferred.ordinal };
    } else {
      monthlyRelative = undefined;
    }

    onRecurrenceChange({
      ...recurrence,
      type,
      until,
      exceptDates: type === "NONE" ? [] : recurrence.exceptDates ?? [],
      customDates: type === "CUSTOM" ? recurrence.customDates ?? [] : [],
      monthlyRelative,
    });
  }

  function renderRecurrenceBlock() {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="wiz-recurrence">Recurrencia</Label>
          <Select
            id="wiz-recurrence"
            value={recurrence.type}
            onChange={(e) =>
              handleRecurrenceTypeChange(e.target.value as RecurrenceType)
            }
          >
            {(Object.keys(RECURRENCE_TYPE_LABELS) as RecurrenceType[]).map(
              (key) => (
                <option key={key} value={key}>
                  {RECURRENCE_TYPE_LABELS[key]}
                </option>
              ),
            )}
          </Select>
        </div>

        {recurrence.type === "MONTHLY_RELATIVE" &&
          recurrence.monthlyRelative && (
            <p className="text-xs text-muted-foreground">
              Se repite el{" "}
              {ordinalLabelEs(recurrence.monthlyRelative.ordinal)}{" "}
              {weekdayNameEs(recurrence.monthlyRelative.weekday)} de cada mes
              (según la fecha elegida), hasta completar las ocurrencias
              indicadas en «Repetir hasta».
            </p>
          )}

        {recurrence.type !== "NONE" && recurrence.type !== "CUSTOM" && (
          <>
            <div className="space-y-1">
              <Label htmlFor="wiz-until">Repetir hasta</Label>
              <Input
                id="wiz-until"
                type="date"
                value={recurrence.until}
                onChange={(e) =>
                  onRecurrenceChange({
                    ...recurrence,
                    until: e.target.value,
                  })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Por defecto equivale a 10 eventos (10 días, 10 semanas, 20
                semanas en quincenal, etc.). Puedes ajustar la fecha.
              </p>
            </div>
            {plannedDatesForExceptions.length > 0 && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showExceptionPicker}
                    onChange={(e) => {
                      setShowExceptionPicker(e.target.checked);
                      if (!e.target.checked) {
                        onRecurrenceChange({
                          ...recurrence,
                          exceptDates: [],
                        });
                      }
                    }}
                    className="rounded border-border"
                  />
                  Definir excepciones (días sin reserva)
                </label>
                {showExceptionPicker && (
                  <ul className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                    {plannedDatesForExceptions.map((isoDate) => {
                      const isException = exceptSet.has(isoDate);
                      const [y, m, d] = isoDate.split("-").map(Number);
                      const label = formatDateDisplay(new Date(y, m - 1, d));
                      return (
                        <li key={isoDate}>
                          <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={isException}
                              onChange={(event) => {
                                const next = new Set(recurrence.exceptDates ?? []);
                                if (event.target.checked) next.add(isoDate);
                                else next.delete(isoDate);
                                onRecurrenceChange({
                                  ...recurrence,
                                  exceptDates: [...next],
                                });
                              }}
                              className="rounded border-border"
                            />
                            <span
                              className={cn(
                                isException &&
                                  "text-muted-foreground line-through",
                              )}
                            >
                              {label}
                              {isException ? " (excepción)" : ""}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </>
        )}

        {recurrence.type === "CUSTOM" && (
          <div className="space-y-2">
            <Label>Fechas personalizadas</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={customDateDraft}
                onChange={(e) => setCustomDateDraft(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!customDateDraft) return;
                  const set = new Set([
                    ...(recurrence.customDates ?? []),
                    customDateDraft,
                  ]);
                  onRecurrenceChange({
                    ...recurrence,
                    customDates: [...set].sort(),
                  });
                  setCustomDateDraft("");
                }}
              >
                Añadir
              </Button>
            </div>
            <ul className="space-y-1 text-sm">
              {(recurrence.customDates ?? []).map((d) => (
                <li key={d} className="flex items-center justify-between gap-2">
                  {formatDateDisplay(new Date(`${d}T12:00:00`))}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      onRecurrenceChange({
                        ...recurrence,
                        customDates: (recurrence.customDates ?? []).filter(
                          (x) => x !== d,
                        ),
                      })
                    }
                  >
                    Quitar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  function renderEventReminderField() {
    return (
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={sendEventReminder}
          onChange={(e) => onSendEventReminderChange(e.target.checked)}
          className="mt-0.5 rounded border-border"
        />
        <span>
          Enviar recordatorio de reserva (notificación in-app 1 día antes)
        </span>
      </label>
    );
  }

  const showAreaEditor =
    showAreaPicker && (!confirmed.area || editingSection === "area");

  const eventDetailsHeaderPanel =
    eventDetailsDone && areaResolved ? (
      <div className="rounded-lg border border-border px-2 py-0.5">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md py-1.5 text-left text-xl font-semibold tracking-tight hover:bg-muted/60 sm:text-2xl"
          onClick={() => setEventDetailsExpanded((v) => !v)}
        >
          {eventName.trim() || "Nombre del evento"}
          {eventDetailsExpanded ? (
            <ChevronUp className="h-5 w-5 shrink-0" />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0" />
          )}
        </button>
        {eventDetailsExpanded && (
          <div className="space-y-2 border-t border-border pb-2 pt-3">
            <div className="space-y-1">
              <Label htmlFor="wiz-eventName-exp">Nombre del evento</Label>
              {renderEventNameField("wiz-eventName-exp")}
            </div>
            <div className="space-y-1">
              <Label htmlFor="wiz-eventDesc-exp">Descripción</Label>
              <textarea
                id="wiz-eventDesc-exp"
                className="flex min-h-[56px] w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={eventDescription}
                onChange={(e) => {
                  setAppliedPresetName(null);
                  onEventDescriptionChange(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wiz-attendees-exp">Asistentes estimados</Label>
              <Input
                id="wiz-attendees-exp"
                type="number"
                min={1}
                className="h-9"
                value={estimatedAttendees}
                onChange={(e) => {
                  setAppliedPresetName(null);
                  onEstimatedAttendeesChange(e.target.value);
                }}
              />
            </div>
            {renderEventReminderField()}
          </div>
        )}
      </div>
    ) : null;

  return (
    <>
      {eventDetailsHeaderEl &&
        eventDetailsHeaderPanel &&
        createPortal(eventDetailsHeaderPanel, eventDetailsHeaderEl)}
      <div className="flex flex-col gap-3 pb-2">
      <Dialog open={areaChangeDialogOpen} onOpenChange={setAreaChangeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cambiar área?</DialogTitle>
            <DialogDescription>
              El nombre del evento coincide con un evento precargado. Si cambias
              de área, revisa que el nombre siga siendo el adecuado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingAreaId(null);
                setAreaChangeDialogOpen(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (pendingAreaId) applyAreaChange(pendingAreaId);
              }}
            >
              Cambiar área
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(calendarDateChangeConfirm)}
        onOpenChange={(open) => {
          if (!open) onCalendarDateChangeCancel?.();
        }}
      >
        <DialogContent className="flex max-h-[min(90dvh,720px)] w-[min(92vw,32rem)] flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 space-y-2 px-6 pt-6">
            <DialogTitle>Confirmar cambio de fecha</DialogTitle>
            <DialogDescription>
              Revisa la nueva fecha, el tipo de recurrencia y las excepciones.
            </DialogDescription>
          </DialogHeader>
          {calendarDateChangeConfirm ? (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 pb-2 text-sm">
              <p>
                <span className="text-muted-foreground">Nueva fecha: </span>
                <span className="font-medium">
                  {formatDateDisplay(
                    new Date(
                      `${calendarDateChangeConfirm.newDate}T12:00:00`,
                    ),
                  )}
                </span>
              </p>
              {calendarDateChangeConfirm.anchorDate !==
                calendarDateChangeConfirm.newDate && (
                <p className="text-xs text-muted-foreground">
                  Anterior:{" "}
                  {formatDateDisplay(
                    new Date(
                      `${calendarDateChangeConfirm.anchorDate}T12:00:00`,
                    ),
                  )}
                </p>
              )}
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="cal-confirm-recurrence">Tipo de recurrencia</Label>
                  <Select
                    id="cal-confirm-recurrence"
                    value={confirmDialogRecurrence.type}
                    onChange={(e) => {
                      const type = e.target.value as RecurrenceType;
                      const next = buildRecurrenceForTypeAtDate(
                        type,
                        calendarDateChangeConfirm.newDate,
                        confirmDialogRecurrence,
                      );
                      setConfirmDialogRecurrence(next);
                      if (type !== "NONE" && type !== "CUSTOM") {
                        setConfirmDialogUntil(next.until);
                      }
                      if (type === "NONE") {
                        setConfirmNewExceptDates(new Set());
                      }
                    }}
                  >
                    {(Object.keys(RECURRENCE_TYPE_LABELS) as RecurrenceType[])
                      .filter((type) => type !== "CUSTOM")
                      .map((type) => (
                        <option key={type} value={type}>
                          {RECURRENCE_TYPE_LABELS[type]}
                        </option>
                      ))}
                  </Select>
                </div>
                {confirmDialogRecurrence.type !== "NONE" && (
                  <>
                  {frozenRecurrence && beforePreviewDates.length > 0 && (
                      <div className="space-y-1.5 rounded-md border border-border bg-muted/20 p-2.5 text-xs">
                        <p className="font-medium text-muted-foreground">
                          Fechas registradas (sin cambios)
                        </p>
                        <p className="text-muted-foreground">
                          {describeRecurrencePattern(
                            calendarDateChangeConfirm.anchorDate,
                            frozenRecurrence,
                          )}
                        </p>
                        <ul className="mt-1 space-y-1">
                          {beforePreviewDates.map((iso) => {
                            const isExcept = frozenExceptSet.has(iso);
                            return (
                              <li
                                key={`before-${iso}`}
                                className={
                                  isExcept
                                    ? "text-muted-foreground line-through"
                                    : ""
                                }
                              >
                                {formatDateDisplay(
                                  new Date(`${iso}T12:00:00`),
                                )}
                                {isExcept && (
                                  <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 no-underline dark:text-amber-400">
                                    Excepción
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  {afterPreviewDates.length > 0 && (
                      <div className="space-y-2 rounded-md border border-border bg-muted/30 p-2.5 text-xs">
                        <p className="font-medium text-muted-foreground">
                          Nuevas fechas
                        </p>
                        {confirmDialogRecurrence.type !== "CUSTOM" && (
                          <div className="space-y-1">
                            <Label htmlFor="cal-confirm-until">
                              Repetir hasta
                            </Label>
                            <Input
                              id="cal-confirm-until"
                              type="date"
                              className="h-9"
                              min={calendarDateChangeConfirm.newDate}
                              value={confirmDialogUntil}
                              onChange={(e) => {
                                const value = e.target.value;
                                setConfirmDialogUntil(value);
                                setConfirmDialogRecurrence((current) => ({
                                  ...current,
                                  until: value,
                                }));
                              }}
                            />
                          </div>
                        )}
                        <p className="text-muted-foreground">
                          {afterRecurrenceForPreview &&
                            describeRecurrencePattern(
                              calendarDateChangeConfirm.newDate,
                              afterRecurrenceForPreview,
                            )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Marca excepción en las fechas que no tendrán reserva.
                        </p>
                        <ul className="mt-1 space-y-1.5">
                          {afterPreviewDates.map((iso) => {
                            const isExcept = confirmNewExceptDates.has(iso);
                            return (
                              <li key={`after-${iso}`}>
                                <label className="flex cursor-pointer items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isExcept}
                                    onChange={(e) => {
                                      setConfirmNewExceptDates((current) => {
                                        const next = new Set(current);
                                        if (e.target.checked) next.add(iso);
                                        else next.delete(iso);
                                        return next;
                                      });
                                    }}
                                    className="rounded border-border"
                                  />
                                  <span
                                    className={
                                      isExcept
                                        ? "text-muted-foreground line-through"
                                        : ""
                                    }
                                  >
                                    {formatDateDisplay(
                                      new Date(`${iso}T12:00:00`),
                                    )}
                                  </span>
                                  {isExcept && (
                                    <span className="text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                                      Excepción
                                    </span>
                                  )}
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : null}
          <DialogFooter className="shrink-0 gap-2 border-t border-border px-6 py-4 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onCalendarDateChangeCancel?.()}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!calendarDateChangeConfirm) return;
                const exceptDates = Array.from(confirmNewExceptDates);
                const usesRecurrence =
                  confirmDialogRecurrence.type !== "NONE" &&
                  (afterRecurrenceForPreview?.type ?? "NONE") !== "NONE";
                onCalendarDateChangeConfirm?.({
                  newDate: calendarDateChangeConfirm.newDate,
                  anchorDate: calendarDateChangeConfirm.anchorDate,
                  keepRecurrence: usesRecurrence,
                  keepExceptions: usesRecurrence && exceptDates.length > 0,
                  exceptDates: usesRecurrence ? exceptDates : [],
                  recurrence: usesRecurrence
                    ? {
                        ...(afterRecurrenceForPreview as RecurrenceConfig),
                        until: confirmDialogUntil,
                        exceptDates,
                      }
                    : undefined,
                });
              }}
            >
              Confirmar fecha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={presetMismatchDialogOpen}
        onOpenChange={setPresetMismatchDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Evento precargado no disponible</DialogTitle>
            <DialogDescription>
              La nueva área no incluye el evento precargado «{appliedPresetName}
              ». Si continúas, se borrarán los datos cargados desde el
              precargado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingAreaId(null);
                setPresetMismatchDialogOpen(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={confirmPresetMismatchAreaChange}>
              Cambiar área y limpiar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Área */}
      {areaResolved && showAreaPicker && (
        <SummaryLine
          label="Área"
          value={areaLabel}
          onClick={() =>
            setEditingSection((current) => (current === "area" ? null : "area"))
          }
        />
      )}

      {showAreaEditor && (
        <section className="space-y-2">
          <Label className="text-sm font-medium">Área o subárea de la reserva</Label>
          <ReservationAreaTreePicker
            areas={areas}
            isAdmin={isAdmin}
            selectableAreaIds={selectableIds}
            value={activeAreaId}
            onChange={requestAreaChange}
          />
        </section>
      )}

      {/* Datos del evento — acumulativo o panel colapsado */}
      {areaResolved && !eventDetailsDone && (
        <section className="space-y-3 rounded-lg border border-border p-3">
          {confirmed.eventName && editingSection !== "eventName" && (
            <SummaryLine
              label="Evento"
              value={eventName.trim()}
              onClick={() => setEditingSection("eventName")}
            />
          )}

          {(!confirmed.eventName || editingSection === "eventName") && (
            <div className="space-y-2">
              <Label htmlFor="wiz-eventName">Nombre del evento</Label>
              {renderEventNameField("wiz-eventName")}
              <ContinueButton
                visible={eventName.trim().length >= 3}
                onClick={() => {
                  setConfirmed((c) => ({ ...c, eventName: true }));
                  setEditingSection(null);
                }}
              />
            </div>
          )}

          {confirmed.eventName &&
            confirmed.eventDescription &&
            editingSection !== "eventDescription" && (
              <SummaryLine
                label="Descripción"
                value={
                  eventDescription.trim().length > 48
                    ? `${eventDescription.trim().slice(0, 48)}…`
                    : eventDescription.trim()
                }
                onClick={() => setEditingSection("eventDescription")}
              />
            )}

          {confirmed.eventName &&
            (!confirmed.eventDescription ||
              editingSection === "eventDescription") && (
              <div className="space-y-2">
                <Label htmlFor="wiz-eventDesc">Descripción del evento</Label>
                <textarea
                  id="wiz-eventDesc"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={eventDescription}
                  onChange={(e) => {
                  setAppliedPresetName(null);
                  onEventDescriptionChange(e.target.value);
                }}
                />
                <ContinueButton
                  visible={eventDescription.trim().length >= 3}
                  onClick={() => {
                    setConfirmed((c) => ({ ...c, eventDescription: true }));
                    setEditingSection(null);
                  }}
                />
              </div>
            )}

          {confirmed.eventDescription &&
            confirmed.attendees &&
            editingSection !== "attendees" && (
              <SummaryLine
                label="Asistentes"
                value={estimatedAttendees}
                onClick={() => setEditingSection("attendees")}
              />
            )}

          {confirmed.eventDescription &&
            (!confirmed.attendees || editingSection === "attendees") && (
              <div className="space-y-2">
                <Label htmlFor="wiz-attendees">Asistentes estimados</Label>
                <Input
                  id="wiz-attendees"
                  type="number"
                  min={1}
                  value={estimatedAttendees}
                  onChange={(e) => {
                    setAppliedPresetName(null);
                    onEstimatedAttendeesChange(e.target.value);
                  }}
                />
                <ContinueButton
                  visible={estimatedNumber > 0}
                  onClick={() => {
                    setConfirmed((c) => ({ ...c, attendees: true }));
                    setEditingSection(null);
                  }}
                />
              </div>
            )}

          {confirmed.attendees && !confirmed.scheduleCollapsed && (
            <div className="space-y-2">
              {renderEventReminderField()}
              <ContinueButton
                visible
                onClick={() => {
                  setConfirmed((c) => ({ ...c, scheduleCollapsed: true }));
                  setEditingSection(null);
                }}
              />
            </div>
          )}
        </section>
      )}

      {eventDetailsDone && !confirmed.date && (
        <section className="space-y-3">
          <div className="space-y-2">
            <Label>Fecha</Label>
            <button
              type="button"
              className="w-full rounded-md border border-dashed border-border px-3 py-2 text-left hover:bg-muted/50"
              onClick={() =>
                onReservationDatePick({ wizardConfirmed: confirmed })
              }
            >
              <p className="text-base font-semibold text-primary underline-offset-2">
                {formatDateDisplay(new Date(`${reservationDate}T12:00:00`))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Toca la fecha para abrir el calendario y elegir otro día.
              </p>
            </button>
          </div>
          {renderRecurrenceBlock()}
          <ContinueButton
            visible={canConfirmRecurrenceStep()}
            onClick={() => {
              onSelectionChange({
                date: reservationDate,
                startTime,
                endTime,
                mapId:
                  selection?.mapId ??
                  restoredSelection?.mapId ??
                  maps[0]?.id ??
                  "",
                selectedSpaceIds: selection?.selectedSpaceIds ?? [],
                selectedResources: selection?.selectedResources ?? [],
              });
              setConfirmed((c) => ({ ...c, date: true, recurrence: true }));
            }}
          />
        </section>
      )}

      {eventDetailsDone && confirmed.date && (
        <section className="space-y-1">
          <Label>Fecha</Label>
          <button
            type="button"
            className="rounded-md px-1 py-0.5 text-left text-base font-semibold text-primary hover:bg-muted/50"
            onClick={() =>
              onReservationDatePick({ wizardConfirmed: confirmed })
            }
          >
            {formatDateDisplay(new Date(`${reservationDate}T12:00:00`))}
          </button>
          <p className="text-xs text-muted-foreground">
            Toca la fecha para cambiarla en el calendario.
          </p>
        </section>
      )}

      {eventDetailsDone &&
        !confirmed.date &&
        needsFourthVsLastPrompt(reservationDate) &&
        recurrence.type === "MONTHLY_RELATIVE" &&
        !relativeDisambiguation && (
          <section className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p>
              En este mes hay 5{" "}
              {weekdayNameEs(new Date(`${reservationDate}T12:00:00`).getDay())}
              s. ¿La repetición será el{" "}
              <strong>cuarto</strong> o el <strong>último</strong> de cada mes?
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setRelativeDisambiguation("FOURTH")}
              >
                Cuarto{" "}
                {weekdayNameEs(new Date(`${reservationDate}T12:00:00`).getDay())}{" "}
                del mes
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setRelativeDisambiguation("LAST")}
              >
                Último{" "}
                {weekdayNameEs(new Date(`${reservationDate}T12:00:00`).getDay())}{" "}
                del mes
              </Button>
            </div>
          </section>
        )}

      {confirmed.date && !confirmed.time && (
        <section className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="wiz-start">Hora inicio</Label>
              <Input
                id="wiz-start"
                type="time"
                value={draftStart}
                onChange={(e) => {
                  const nextStart = e.target.value;
                  let nextEnd = draftEnd;
                  setDraftStart(nextStart);
                  if (!nextEnd || nextEnd <= nextStart) {
                    nextEnd = addMinutesToTimeHHmm(nextStart, 60);
                    setDraftEnd(nextEnd);
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wiz-end">Hora fin</Label>
              <Input
                id="wiz-end"
                type="time"
                value={draftEnd}
                onChange={(e) => setDraftEnd(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Ajusta inicio y fin arriba y pulsa Continuar para confirmar el
            horario.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              syncTimeToSelection(draftStart, draftEnd);
              setConfirmed((c) => ({ ...c, time: true }));
            }}
          >
            Continuar »
          </Button>
        </section>
      )}

      {confirmed.time && (
        <section className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="wiz-start-done">Hora inicio</Label>
              <Input
                id="wiz-start-done"
                type="time"
                value={draftStart}
                onChange={(e) => {
                  const nextStart = e.target.value;
                  let nextEnd = draftEnd;
                  setDraftStart(nextStart);
                  if (!nextEnd || nextEnd <= nextStart) {
                    nextEnd = addMinutesToTimeHHmm(nextStart, 60);
                    setDraftEnd(nextEnd);
                  }
                  syncTimeToSelection(nextStart, nextEnd);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wiz-end-done">Hora fin</Label>
              <Input
                id="wiz-end-done"
                type="time"
                value={draftEnd}
                onChange={(e) => {
                  const nextEnd = e.target.value;
                  setDraftEnd(nextEnd);
                  syncTimeToSelection(draftStart, nextEnd);
                }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Puedes modificar el horario en cualquier momento antes de confirmar
            la reserva.
          </p>
        </section>
      )}

      {confirmed.time && (
        <>
          {recurrence.type !== "NONE" && recurrencePreview.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Recurrencia: {recurrencePreview.length} fecha(s) prevista(s)
            </p>
          )}
          <MapDateSelector
            key={`map-${mapSelectorKey}`}
            maps={maps}
            spaces={spaces}
            initialDate={reservationDate}
            initialMapId={initialMapId}
            initialSpaceId={initialSpaceId}
            initialSelection={{
              date: reservationDate,
              startTime,
              endTime,
              mapId: restoredSelection?.mapId ?? initialMapId,
              selectedSpaceIds: selection?.selectedSpaceIds ?? [],
              selectedResources: Object.fromEntries(
                (selection?.selectedResources ?? []).map((r) => [
                  r.resourceId,
                  r.quantity,
                ]),
              ),
            }}
            areas={areas}
            highlightAreaId={activeHighlightAreaId}
            layout="reservation"
            showResourcePanel
            showCalendarLink={false}
            hideScheduleUI
            mapOnly
            emptySpaceLegend="Toca para seleccionar un espacio del mapa"
            resourcesSheetOpen={resourcesOpen}
            onResourcesSheetOpenChange={onResourcesOpenChange}
            onSelectionChange={onSelectionChange}
            estimatedAttendees={estimatedNumber}
            resourcesDisabled={
              (selection?.selectedSpaceIds.length ?? 0) === 0 ||
              Boolean(needsJustification && !attendeeJustificationCode)
            }
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={
              (selection?.selectedSpaceIds.length ?? 0) === 0 ||
              Boolean(needsJustification && !attendeeJustificationCode)
            }
            onClick={() => onResourcesOpenChange(true)}
          >
            Recursos{resourceCount > 0 ? ` (${resourceCount})` : ""}
          </Button>
          {(selection?.selectedSpaceIds.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground">
              Selecciona al menos un espacio en el mapa para agregar recursos.
            </p>
          )}

          {needsJustification && (
            <section className="space-y-2 rounded-md border border-amber-500/40 p-3">
              <Label>Justificación de asistentes</Label>
              <Select
                value={attendeeJustificationCode}
                onChange={(e) =>
                  onAttendeeJustificationCodeChange(e.target.value)
                }
              >
                <option value="">Selecciona…</option>
                {ATTENDEE_JUSTIFICATION_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              {attendeeJustificationCode === "OTHER" && (
                <Input
                  placeholder="Describe la justificación"
                  value={attendeeJustificationNote}
                  onChange={(e) =>
                    onAttendeeJustificationNoteChange(e.target.value)
                  }
                />
              )}
            </section>
          )}

          <Button
            size="lg"
            className="h-10 w-full"
            disabled={!canSubmit || loading}
            onClick={onSubmit}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              "Confirmar reserva"
            )}
          </Button>
        </>
      )}
      </div>
    </>
  );
}
