import type { NextFunction, Request, Response } from "express";

import { prisma } from "../../lib/prisma.js";
import catchAsync from "../../utils/catchAsync.js";
import { AppError } from "../../utils/appError.js";

type UpdateSettingsBody = {
  agencyName?: string | null;
  agencyEmail?: string | null;
  agencyPhone?: string | null;
  websiteUrl?: string | null;
  timezone?: string;
  currency?: string;
};

/*
 * ─────────────────────────────────────────────
 * GET SETTINGS
 * ─────────────────────────────────────────────
 *
 * GET /api/v1/settings
 */

export const getSettings = catchAsync(async (req: Request, res: Response) => {
  const settings = await prisma.generalSettings.upsert({
    where: {
      id: "singleton",
    },
    create: {
      id: "singleton",
    },
    update: {},
  });

  return res.status(200).json({
    status: "success",
    data: {
      settings,
    },
  });
});

/*
 * ─────────────────────────────────────────────
 * UPDATE SETTINGS
 * ─────────────────────────────────────────────
 *
 * PATCH /api/v1/settings
 */

export const updateSettings = catchAsync(
  async (
    req: Request<{}, {}, UpdateSettingsBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const {
      agencyName,
      agencyEmail,
      agencyPhone,
      websiteUrl,
      timezone,
      currency,
    } = req.body;

    if (
      agencyName === undefined &&
      agencyEmail === undefined &&
      agencyPhone === undefined &&
      websiteUrl === undefined &&
      timezone === undefined &&
      currency === undefined
    ) {
      return next(
        new AppError("Please provide at least one setting to update.", 400),
      );
    }

    const settings = await prisma.generalSettings.upsert({
      where: {
        id: "singleton",
      },

      create: {
        id: "singleton",
        ...(agencyName !== undefined && { agencyName }),
        ...(agencyEmail !== undefined && { agencyEmail }),
        ...(agencyPhone !== undefined && { agencyPhone }),
        ...(websiteUrl !== undefined && { websiteUrl }),
        ...(timezone !== undefined && { timezone }),
        ...(currency !== undefined && { currency }),
      },

      update: {
        ...(agencyName !== undefined && { agencyName }),
        ...(agencyEmail !== undefined && { agencyEmail }),
        ...(agencyPhone !== undefined && { agencyPhone }),
        ...(websiteUrl !== undefined && { websiteUrl }),
        ...(timezone !== undefined && { timezone }),
        ...(currency !== undefined && { currency }),
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Settings updated successfully.",
      data: {
        settings,
      },
    });
  },
);
