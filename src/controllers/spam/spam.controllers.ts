import { type NextFunction, type Request, type Response } from "express";

import { prisma } from "../../lib/prisma.js";
import catchAsync from "../../utils/catchAsync.js";
import { AppError } from "../../utils/appError.js";

import { ContactStatus } from "../../generated/prisma/enums.js";

type SpamParams = {
  id: string;
};

/*
 * ─────────────────────────────────────────────
 * GET ALL SPAM CONTACTS
 * ─────────────────────────────────────────────
 *
 * GET /api/v1/spam
 */

export const getSpamContacts = catchAsync(
  async (req: Request, res: Response) => {
    const contacts = await prisma.contact.findMany({
      where: {
        status: ContactStatus.SPAM,
      },
      orderBy: {
        rejectedAt: "desc",
      },
    });

    return res.status(200).json({
      status: "success",
      results: contacts.length,
      data: {
        contacts,
      },
    });
  },
);

/*
 * ─────────────────────────────────────────────
 * GET SPAM CONTACT BY ID
 * ─────────────────────────────────────────────
 *
 * GET /api/v1/spam/:id
 */

export const getSpamContactById = catchAsync(
  async (req: Request<SpamParams>, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const contact = await prisma.contact.findFirst({
      where: {
        id,
        status: ContactStatus.SPAM,
      },
    });

    if (!contact) {
      return next(new AppError("Spam contact not found with that ID.", 404));
    }

    return res.status(200).json({
      status: "success",
      data: {
        contact,
      },
    });
  },
);

/*
 * ─────────────────────────────────────────────
 * RESTORE SPAM CONTACT
 * ─────────────────────────────────────────────
 *
 * POST /api/v1/spam/:id/restore
 *
 * Workflow:
 *
 * Spam
 *   ↓
 * Restore
 *   ↓
 * New Contact
 */

export const restoreSpamContact = catchAsync(
  async (req: Request<SpamParams>, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const contact = await prisma.contact.findFirst({
      where: {
        id,
        status: ContactStatus.SPAM,
      },
    });

    if (!contact) {
      return next(new AppError("Spam contact not found with that ID.", 404));
    }

    const restoredContact = await prisma.contact.update({
      where: {
        id,
      },
      data: {
        status: ContactStatus.NEW,
        rejectionReason: null,
        rejectedAt: null,
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Contact restored successfully.",
      data: {
        contact: restoredContact,
      },
    });
  },
);

/*
 * ─────────────────────────────────────────────
 * PERMANENTLY DELETE SPAM CONTACT
 * ─────────────────────────────────────────────
 *
 * DELETE /api/v1/spam/:id
 *
 * This permanently removes the contact.
 *
 * Only SUPER_ADMIN should be allowed to perform
 * this operation at the route level.
 */

export const deleteSpamContact = catchAsync(
  async (req: Request<SpamParams>, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const contact = await prisma.contact.findFirst({
      where: {
        id,
        status: ContactStatus.SPAM,
      },
      select: {
        id: true,
      },
    });

    if (!contact) {
      return next(new AppError("Spam contact not found with that ID.", 404));
    }

    await prisma.contact.delete({
      where: {
        id,
      },
    });

    return res.status(204).send();
  },
);
