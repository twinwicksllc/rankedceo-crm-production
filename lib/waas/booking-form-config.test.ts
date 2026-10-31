import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BOOKING_FORM_DEFAULTS,
  bookingFormMode,
  resolveBookingFormSettings,
} from "./booking-form-config";
import { validateConfigValue } from "./client-edit/content-paths";
import { buildEditableFields } from "./client-edit/editable-fields";

describe("resolveBookingFormSettings", () => {
  it("is ON with default copy for a site that never set anything", () => {
    const s = resolveBookingFormSettings({});
    assert.equal(s.enabled, true);
    assert.equal(s.heading, BOOKING_FORM_DEFAULTS.heading);
    assert.deepEqual(s.services, []);
    assert.equal(resolveBookingFormSettings(undefined).enabled, true);
  });

  it("reads booleans written as booleans or strings", () => {
    assert.equal(resolveBookingFormSettings({ formEnabled: false }).enabled, false);
    assert.equal(resolveBookingFormSettings({ formEnabled: "false" }).enabled, false);
    assert.equal(resolveBookingFormSettings({ formEnabled: "true" }).enabled, true);
    assert.equal(resolveBookingFormSettings({ formEnabled: "nonsense" }).enabled, true);
  });

  it("reads the services list as an array or CSV, trimmed, empties dropped, capped", () => {
    assert.deepEqual(
      resolveBookingFormSettings({ formServices: " Drain cleaning, ,Repipe " }).services,
      ["Drain cleaning", "Repipe"],
    );
    assert.deepEqual(resolveBookingFormSettings({ formServices: ["A", "B"] }).services, ["A", "B"]);
    assert.equal(
      resolveBookingFormSettings({ formServices: "1,2,3,4,5,6,7,8,9,10" }).services.length,
      8,
    );
  });

  it("falls back to defaults for blank text", () => {
    const s = resolveBookingFormSettings({ formHeading: "   ", formButtonLabel: "Get a quote" });
    assert.equal(s.heading, BOOKING_FORM_DEFAULTS.heading);
    assert.equal(s.buttonLabel, "Get a quote");
  });
});

describe("bookingFormMode", () => {
  it("is off when the owner turned it off", () => {
    assert.equal(bookingFormMode({ settingsEnabled: false, tenantStatus: "active", hasToken: true }), "off");
  });
  it("is a non-submitting preview until the site is live", () => {
    assert.equal(bookingFormMode({ settingsEnabled: true, tenantStatus: "onboarding", hasToken: true }), "preview");
  });
  it("is live only with an active site and a signing token", () => {
    assert.equal(bookingFormMode({ settingsEnabled: true, tenantStatus: "active", hasToken: true }), "live");
    assert.equal(bookingFormMode({ settingsEnabled: true, tenantStatus: "active", hasToken: false }), "off");
  });
});

describe("booking form settings are editable by the client", () => {
  const keys = ["formEnabled", "formHeading", "formButtonLabel", "formSuccessMessage", "formServices"];

  it("passes the config value validators", () => {
    assert.equal(validateConfigValue("formEnabled", false).valid, true);
    assert.equal(validateConfigValue("formEnabled", "maybe").valid, false);
    assert.equal(validateConfigValue("formHeading", "Talk to us").valid, true);
    assert.equal(validateConfigValue("formHeading", "x".repeat(200)).valid, false);
    assert.equal(validateConfigValue("formServices", "A, B, C").valid, true);
    assert.equal(validateConfigValue("formServices", "1,2,3,4,5,6,7,8,9").valid, false);
  });

  it("appear in the editor for a booking section", () => {
    const fields = buildEditableFields({
      sections: [
        { id: "sec-booking-1", section: "booking", enabled: true, order: 0, config: {}, content: {} },
      ],
      brandConfig: {},
    } as never);
    const paths = fields.map((f) => f.path);
    for (const key of keys) {
      assert.ok(
        paths.some((p) => p.endsWith(`.config.${key}`)),
        `${key} is editable`,
      );
    }
  });
});
