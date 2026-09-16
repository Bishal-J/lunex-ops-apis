import { type NextFunction, type Request, type Response } from "express";

import { prisma } from "../../lib/prisma.js";
import catchAsync from "../../utils/catchAsync.js";
import { AppError } from "../../utils/appError.js";

type ContactParams = {
  id: string;
};

type RejectContactBody = {
  rejectionReason?: string;
};

/*
 * ─────────────────────────────────────────────
 * GET ALL CONTACTS
 * ─────────────────────────────────────────────
 *
 * GET /api/v1/contacts
 *
 * Returns active/new contacts.
 * Spam contacts are handled separately.
 */

export const getContacts = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const contacts = await prisma.contact.findMany({
      where: {
        status: {
          not: "SPAM",
        },
      },
      orderBy: {
        createdAt: "desc",
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
 * GET CONTACT BY ID
 * ─────────────────────────────────────────────
 *
 * GET /api/v1/contacts/:id
 */

export const getContactById = catchAsync(
  async (req: Request<ContactParams>, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const contact = await prisma.contact.findUnique({
      where: {
        id,
      },
      include: {
        lead: true,
      },
    });

    if (!contact) {
      return next(new AppError("Contact not found with that ID.", 404));
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
 * CREATE CONTACT
 * ─────────────────────────────────────────────
 *
 * POST /api/v1/contacts
 *
 * This endpoint is used by the public website.
 */

export const createContact = catchAsync(async (req: Request, res: Response) => {
  const {
    name,
    company,
    email,
    phone,
    website,
    industry,
    projectType,
    budget,
    timeline,
    projectDetails,
    referral,
  } = req.body;

  const contact = await prisma.contact.create({
    data: {
      name,
      company,
      email,
      phone,
      website,
      industry,
      projectType,
      budget,
      timeline,
      projectDetails,
      referral,
    },
  });

  return res.status(201).json({
    status: "success",
    data: {
      contact,
    },
  });
});

/*
 * ─────────────────────────────────────────────
 * UPDATE CONTACT
 * ─────────────────────────────────────────────
 *
 * PATCH /api/v1/contacts/:id
 *
 * Used for editing contact information.
 *
 * Status changes should NOT be handled here.
 * Use accept/reject endpoints for workflow actions.
 */

export const updateContact = catchAsync(
  async (req: Request<ContactParams>, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const existingContact = await prisma.contact.findUnique({
      where: {
        id,
      },
    });

    if (!existingContact) {
      return next(new AppError("Contact not found with that ID.", 404));
    }

    /*
     * Prevent workflow fields from being changed
     * through the generic update endpoint.
     */
    if (
      req.body.status !== undefined ||
      req.body.rejectionReason !== undefined ||
      req.body.rejectedAt !== undefined
    ) {
      return next(
        new AppError(
          "Contact status must be changed through the appropriate action.",
          400,
        ),
      );
    }

    const {
      name,
      company,
      email,
      phone,
      website,
      industry,
      projectType,
      budget,
      timeline,
      projectDetails,
      referral,
    } = req.body;

    const contact = await prisma.contact.update({
      where: {
        id,
      },
      data: {
        ...(name !== undefined && { name }),
        ...(company !== undefined && { company }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(website !== undefined && { website }),
        ...(industry !== undefined && { industry }),
        ...(projectType !== undefined && { projectType }),
        ...(budget !== undefined && { budget }),
        ...(timeline !== undefined && { timeline }),
        ...(projectDetails !== undefined && { projectDetails }),
        ...(referral !== undefined && { referral }),
      },
    });

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
 * ACCEPT CONTACT
 * ─────────────────────────────────────────────
 *
 * POST /api/v1/contacts/:id/accept
 *
 * Workflow:
 *
 * Contact NEW
 *      ↓
 * Create Lead
 *      ↓
 * Contact CONVERTED
 *
 * This MUST be a transaction.
 */

export const acceptContact = catchAsync(
  async (req: Request<ContactParams>, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const contact = await prisma.contact.findUnique({
      where: {
        id,
      },
    });

    if (!contact) {
      return next(new AppError("Contact not found with that ID.", 404));
    }

    if (contact.status === "SPAM") {
      return next(
        new AppError(
          "A spam contact cannot be accepted. Restore it first.",
          400,
        ),
      );
    }

    if (contact.status === "CONVERTED") {
      return next(
        new AppError("This contact has already been converted to a lead.", 400),
      );
    }

    const lead = await prisma.$transaction(async (tx) => {
      const newLead = await tx.lead.create({
        data: {
          contactId: contact.id,
        },
        include: {
          contact: true,
        },
      });

      await tx.contact.update({
        where: {
          id: contact.id,
        },
        data: {
          status: "CONVERTED",
        },
      });

      return newLead;
    });

    return res.status(201).json({
      status: "success",
      message: "Contact accepted and converted to a lead.",
      data: {
        lead,
      },
    });
  },
);

/*
 * ─────────────────────────────────────────────
 * REJECT CONTACT
 * ─────────────────────────────────────────────
 *
 * POST /api/v1/contacts/:id/reject
 *
 * Workflow:
 *
 * Contact NEW
 *      ↓
 * Contact SPAM
 */

export const rejectContact = catchAsync(
  async (
    req: Request<ContactParams, {}, RejectContactBody>,
    res: Response,
    next: NextFunction,
  ) => {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const contact = await prisma.contact.findUnique({
      where: {
        id,
      },
    });

    if (!contact) {
      return next(new AppError("Contact not found with that ID.", 404));
    }

    if (contact.status === "CONVERTED") {
      return next(
        new AppError("A converted contact cannot be moved to spam.", 400),
      );
    }

    if (contact.status === "SPAM") {
      return next(new AppError("Contact is already in spam.", 400));
    }

    const updatedContact = await prisma.contact.update({
      where: {
        id,
      },
      data: {
        status: "SPAM",
        rejectionReason: rejectionReason ?? null,
        rejectedAt: new Date(),
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Contact moved to spam.",
      data: {
        contact: updatedContact,
      },
    });
  },
);
