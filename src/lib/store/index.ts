/*
 * The active quotation store. Automatically picks Supabase when
 * SUPABASE_SERVICE_ROLE_KEY is set, otherwise the local JSON file.
 * All callers import from "@/lib/store" — never a concrete implementation.
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
