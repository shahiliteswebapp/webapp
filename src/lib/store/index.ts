/*
 * The active quotation store. Automatically picks Supabase when a Supabase
 * key is set, otherwise the local JSON file. All callers import from
 * "@/lib/store" -- never a concrete implementation.
 */
import { supabaseConfigured } from "@/lib/supabase";
import * as jsonStore from "./jsonStore";
import * as supabaseStore from "./supabaseStore";

export type {
  QuotationFilter,
  CreateQuotationInput,
} from "@/lib/types";

const impl = supabaseConfigured() ? supabaseStore : jsonStore;

export const listQuotations = impl.listQuotations;
export const getQuotation = impl.getQuotation;
export const listEvents = impl.listEvents;
export const createQuotation = impl.createQuotation;
export const setStatus = impl.setStatus;

export const isAllowed = impl.isAllowed;
export const touchSignIn = impl.touchSignIn;
export const listAccess = impl.listAccess;
export const addAccess = impl.addAccess;
export const removeAccess = impl.removeAccess;
export const restoreAccess = impl.restoreAccess;
