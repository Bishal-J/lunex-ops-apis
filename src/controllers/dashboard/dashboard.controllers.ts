import type { Request, Response } from "express";

import { prisma } from "../../lib/prisma.js";
import catchAsync from "../../utils/catchAsync.js";

import { ContactStatus, LeadStatus } from "../../../generated/prisma/enums.js";

/*
 * ─────────────────────────────────────────────
 * GET DASHBOARD
 * ─────────────────────────────────────────────
 *
 * GET /api/v1/dashboard
 *
 * Returns the main statistics required by the
 * admin dashboard.
 */

export const getDashboard = catchAsync(async (req: Request, res: Response) => {
  const now = new Date();

  const [
    totalContacts,
    newContacts,
    spamContacts,
    totalLeads,
    wonLeads,
    lostLeads,
    unassignedLeads,
    followUpsDue,
    pipelineValue,
    recentContacts,
    recentLeads,
  ] = await Promise.all([
    /*
     * Contacts
     */

    prisma.contact.count(),

    prisma.contact.count({
      where: {
        status: ContactStatus.NEW,
      },
    }),

    prisma.contact.count({
      where: {
        status: ContactStatus.SPAM,
      },
    }),

    /*
     * Leads
     */

    prisma.lead.count(),

    prisma.lead.count({
      where: {
        status: LeadStatus.WON,
      },
    }),

    prisma.lead.count({
      where: {
        status: LeadStatus.LOST,
      },
    }),

    prisma.lead.count({
      where: {
        assignedToId: null,
      },
    }),

    /*
     * Follow-ups
     *
     * Only leads that have a follow-up date
     * and whose date has passed are included.
     */

    prisma.lead.count({
      where: {
        nextFollowUpAt: {
          lte: now,
        },
        status: {
          notIn: [LeadStatus.WON, LeadStatus.LOST],
        },
      },
    }),

    /*
     * Total estimated pipeline value
     *
     * Only active leads are included.
     */

    prisma.lead.aggregate({
      _sum: {
        estimatedValue: true,
      },
      where: {
        status: {
          notIn: [LeadStatus.WON, LeadStatus.LOST],
        },
      },
    }),

    /*
     * Recent contacts
     */

    prisma.contact.findMany({
      take: 5,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        projectType: true,
        status: true,
        createdAt: true,
      },
    }),

    /*
     * Recent leads
     */

    prisma.lead.findMany({
      take: 5,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        status: true,
        estimatedValue: true,
        nextFollowUpAt: true,
        createdAt: true,

        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
          },
        },

        assignedTo: {
          select: {
            id: true,
            username: true,
            name: true,
            photo: true,
          },
        },
      },
    }),
  ]);

  /*
   * Convert Prisma Decimal into a value that can
   * safely be returned as JSON.
   */

  const totalPipelineValue = pipelineValue._sum.estimatedValue?.toNumber() ?? 0;

  return res.status(200).json({
    status: "success",

    data: {
      overview: {
        contacts: {
          total: totalContacts,
          new: newContacts,
          spam: spamContacts,
        },

        leads: {
          total: totalLeads,
          won: wonLeads,
          lost: lostLeads,
          unassigned: unassignedLeads,
          followUpsDue,
        },

        pipeline: {
          estimatedValue: totalPipelineValue,
        },
      },

      recentContacts,

      recentLeads,
    },
  });
});
