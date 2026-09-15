"use client";

import { createContext, useContext } from "react";

/**
 * Админкаға кім кірді: әкімші ме, бухгалтер ме.
 * Мәнін app/admin/layout.tsx қояды — беттер профильді қайта сұрамайды.
 *
 * Әдепкі мән — ең тар құқық ("accountant"): контекстен тыс бір бет
 * кездейсоқ қолданылса, артық батырма көрсетпейді. Нағыз қорғаныс бәрібір
 * базада (064 миграциясы).
 */
export type StaffRole = "admin" | "accountant";

const StaffRoleContext = createContext<StaffRole>("accountant");

export const StaffRoleProvider = StaffRoleContext.Provider;

export function useStaffRole(): StaffRole {
  return useContext(StaffRoleContext);
}

/** Бухгалтерге ашық беттер. Қалғанының бәрі — «рұқсат жоқ». */
export const ACCOUNTANT_PATHS = ["/admin/bookings", "/admin/sessions"];
