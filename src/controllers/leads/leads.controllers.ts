import type { NextFunction, Request, Response } from "express";

import { prisma } from "../../lib/prisma.js";
import catchAsync from "../../utils/catchAsync.js";
import { AppError } from "../../utils/appError.js";

import { LeadStatus } from "../../../generated/prisma/enums.js";
import { Prisma } from "../../../generated/prisma/client.js";

type LeadParams = {
  id: string;
};

type UpdateLeadBody = {
  status?: LeadStatus;
  assignedToId?: string | null;
  estimatedValue?: number | string | null;
  lastContactedAt?: string | Date | null;
  nextFollowUpAt?: string | Date | null;
  notes?: string | null;
};

/*
 * ─────────────────────────────────────────────
 * GET ALL LEADS
 * ─────────────────────────────────────────────
 *
 * GET /api/v1/leads
 */

export const getLeads = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const leads = await prisma.lead.findMany({
      include: {
        contact: true,
        assignedTo: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
            photo: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      status: "success",
      results: leads.length,
      data: {
        leads,
      },
    });
  },
);

/*
 * ─────────────────────────────────────────────
 * GET LEAD BY ID
 * ─────────────────────────────────────────────
 *
 * GET /api/v1/leads/:id
 */

export const getLeadById = catchAsync(
  async (req: Request<LeadParams>, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: {
        id,
      },
      include: {
        contact: true,
        assignedTo: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
            photo: true,
          },
        },
      },
    });

    if (!lead) {
      return next(new AppError("Lead not found with that ID.", 404));
    }

    return res.status(200).json({
      status: "success",
      data: {
        lead,
      },
    });
  },
);

/*
 * ─────────────────────────────────────────────
 * UPDATE LEAD
 * ─────────────────────────────────────────────
 *
 * PATCH /api/v1/leads/:id
 *
 * Can update:
 * - status
 * - assignedToId
 * - estimatedValue
 * - lastContactedAt
 * - nextFollowUpAt
 * - notes
 */

export const updateLead = catchAsync(
  async (
    req: Request<LeadParams, {}, UpdateLeadBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const { id } = req.params;

    const existingLead = await prisma.lead.findUnique({
      where: {
        id,
      },
    });

    if (!existingLead) {
      return next(new AppError("Lead not found with that ID.", 404));
    }

    const {
      status,
      assignedToId,
      estimatedValue,
      lastContactedAt,
      nextFollowUpAt,
      notes,
    } = req.body;

    if (
      status === undefined &&
      assignedToId === undefined &&
      estimatedValue === undefined &&
      lastContactedAt === undefined &&
      nextFollowUpAt === undefined &&
      notes === undefined
    ) {
      return next(
        new AppError("Please provide at least one field to update.", 400),
      );
    }

    /*
     * Validate assigned user.
     */
    if (assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: {
          id: assignedToId,
        },
        select: {
          id: true,
          isActive: true,
        },
      });

      if (!assignedUser) {
        return next(new AppError("Assigned user not found.", 404));
      }

      if (!assignedUser.isActive) {
        return next(
          new AppError("Cannot assign a lead to an inactive user.", 400),
        );
      }
    }

    /*
     * Validate estimated value.
     */
    if (estimatedValue !== undefined && estimatedValue !== null) {
      const value = Number(estimatedValue);

      if (Number.isNaN(value) || value < 0) {
        return next(
          new AppError("Estimated value must be a valid positive number.", 400),
        );
      }
    }

    /*
     * Validate dates.
     */
    let parsedLastContactedAt: Date | null | undefined;

    let parsedNextFollowUpAt: Date | null | undefined;

    if (lastContactedAt !== undefined) {
      parsedLastContactedAt =
        lastContactedAt === null ? null : new Date(lastContactedAt);

      if (
        parsedLastContactedAt !== null &&
        Number.isNaN(parsedLastContactedAt.getTime())
      ) {
        return next(new AppError("lastContactedAt must be a valid date.", 400));
      }
    }

    if (nextFollowUpAt !== undefined) {
      parsedNextFollowUpAt =
        nextFollowUpAt === null ? null : new Date(nextFollowUpAt);

      if (
        parsedNextFollowUpAt !== null &&
        Number.isNaN(parsedNextFollowUpAt.getTime())
      ) {
        return next(new AppError("nextFollowUpAt must be a valid date.", 400));
      }
    }

    // Validate dates
    if (lastContactedAt !== undefined && lastContactedAt !== null) {
      const date = new Date(lastContactedAt);

      if (Number.isNaN(date.getTime())) {
        return next(new AppError("lastContactedAt must be a valid date.", 400));
      }
    }

    if (nextFollowUpAt !== undefined && nextFollowUpAt !== null) {
      const date = new Date(nextFollowUpAt);

      if (Number.isNaN(date.getTime())) {
        return next(new AppError("nextFollowUpAt must be a valid date.", 400));
      }
    }

    // Update
    const lead = await prisma.lead.update({
      where: {
        id,
      },
      data: {
        ...(status !== undefined && {
          status,
        }),

        ...(assignedToId !== undefined && {
          assignedTo:
            assignedToId === null
              ? { disconnect: true }
              : { connect: { id: assignedToId } },
        }),

        ...(estimatedValue !== undefined && {
          estimatedValue:
            estimatedValue === null ? null : new Prisma.Decimal(estimatedValue),
        }),

        ...(lastContactedAt !== undefined && {
          lastContactedAt:
            lastContactedAt === null ? null : new Date(lastContactedAt),
        }),

        ...(nextFollowUpAt !== undefined && {
          nextFollowUpAt:
            nextFollowUpAt === null ? null : new Date(nextFollowUpAt),
        }),

        ...(notes !== undefined && {
          notes,
        }),
      },
      include: {
        contact: true,
        assignedTo: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
            photo: true,
          },
        },
      },
    });

    return res.status(200).json({
      status: "success",
      data: {
        lead,
      },
    });
  },
);

/*
 * ─────────────────────────────────────────────
 * ASSIGN LEAD
 * ─────────────────────────────────────────────
 *
 * PATCH /api/v1/leads/:id/assign
 */

export const assignLead = catchAsync(
  async (req: Request<LeadParams>, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { assignedToId } = req.body;

    if (!assignedToId) {
      return next(new AppError("Assigned user ID is required.", 400));
    }

    const lead = await prisma.lead.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
      },
    });

    if (!lead) {
      return next(new AppError("Lead not found with that ID.", 404));
    }

    const user = await prisma.user.findUnique({
      where: {
        id: assignedToId,
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        photo: true,
        isActive: true,
      },
    });

    if (!user) {
      return next(new AppError("User not found with that ID.", 404));
    }

    if (!user.isActive) {
      return next(
        new AppError("Cannot assign a lead to an inactive user.", 400),
      );
    }

    const updatedLead = await prisma.lead.update({
      where: {
        id,
      },
      data: {
        assignedToId: user.id,
      },
      include: {
        contact: true,
        assignedTo: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
            photo: true,
          },
        },
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Lead assigned successfully.",
      data: {
        lead: updatedLead,
      },
    });
  },
);

/*
 * ─────────────────────────────────────────────
 * UNASSIGN LEAD
 * ─────────────────────────────────────────────
 *
 * PATCH /api/v1/leads/:id/unassign
 */

export const unassignLead = catchAsync(
  async (req: Request<LeadParams>, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
      },
    });

    if (!lead) {
      return next(new AppError("Lead not found with that ID.", 404));
    }

    const updatedLead = await prisma.lead.update({
      where: {
        id,
      },
      data: {
        assignedToId: null,
      },
      include: {
        contact: true,
        assignedTo: {
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
            photo: true,
          },
        },
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Lead unassigned successfully.",
      data: {
        lead: updatedLead,
      },
    });
  },
);

/*
 * ─────────────────────────────────────────────
 * DELETE LEAD
 * ─────────────────────────────────────────────
 *
 * DELETE /api/v1/leads/:id
 *
 * This is a hard delete.
 *
 * Because the Contact → Lead relation uses
 * onDelete: Cascade, deleting a Lead itself
 * does NOT delete the Contact.
 */

export const deleteLead = catchAsync(
  async (req: Request<LeadParams>, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
      },
    });

    if (!lead) {
      return next(new AppError("Lead not found with that ID.", 404));
    }

    await prisma.lead.delete({
      where: {
        id,
      },
    });

    return res.status(204).send();
  },
);
