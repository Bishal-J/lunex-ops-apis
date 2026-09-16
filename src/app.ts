import express, {
  NextFunction,
  Request,
  Response,
  type Express,
} from "express";
import morgan from "morgan";
import cors, { CorsOptions } from "cors";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import hpp from "hpp";

import dashboardsRoutes from "./routes/dashboard.routes.js";
import contactsRoutes from "./routes/contacts.routes.js";
import leadsRoutes from "./routes/leads.routes.js";
import spamsRoutes from "./routes/spam.routes.js";
import settingsRoutes from "./routes/settings.routes.js";
import usersRoutes from "./routes/users.routes.js";
import { globalErrorHandler } from "./middleware/error.middleware.js";
import { AppError } from "./utils/appError.js";

const app: Express = express();

app.use(helmet());

app.use(morgan("dev"));

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 100,
  message: {
    status: "exceeded",
    message: "Too many requests from this IP, please try again in an hour!",
  },
});

app.use(limiter);

app.use(hpp());

app.use(
  express.json({
    limit: "1024kb",
  }),
);
app.use(express.urlencoded({ extended: true }));

const allowedOrigins: string[] = [
  "https://admin.lunex-ops.com",
  "https://lunex-ops.com",
];

const corsOptions: CorsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

app.use(cors(corsOptions));

app.use("/api/v1/dashboards", dashboardsRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/contacts", contactsRoutes);
app.use("/api/v1/leads", leadsRoutes);
app.use("/api/v1/spams", spamsRoutes);
app.use("/api/v1/settings", settingsRoutes);

// Handling unhandled routes
app.all("*any", (req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

export default app;
