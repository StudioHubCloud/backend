
-- Function to check if a type exists
CREATE OR REPLACE FUNCTION type_exists (type_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM pg_type WHERE typname = type_name);
END;
$$ LANGUAGE plpgsql;

-- Create pass_status_enum if it doesn't exist
DO $$
BEGIN
  IF NOT type_exists('pass_status_enum') THEN
    CREATE TYPE "public"."pass_status_enum" AS ENUM('active', 'paused', 'expired');
  END IF;
END$$;

-- Create subscribtion_status_enum if it doesn't exist
DO $$
BEGIN
  IF NOT type_exists('subscribtion_status_enum') THEN
    CREATE TYPE "public"."subscribtion_status_enum" AS ENUM('active', 'paused', 'expired', 'canceled');
  END IF;
END$$;

-- Create subscribtion_tier_enum if it doesn't exist
DO $$
BEGIN
  IF NOT type_exists('subscribtion_tier_enum') THEN
    CREATE TYPE "public"."subscribtion_tier_enum" AS ENUM('basic', 'professional', 'elite');
  END IF;
END$$;

-- Create training_status_enum if it doesn't exist
DO $$
BEGIN
  IF NOT type_exists('training_status_enum') THEN
    CREATE TYPE "public"."training_status_enum" AS ENUM('active', 'canceled', 'completed');
  END IF;
END$$;

-- Create training_type_enum if it doesn't exist
DO $$
BEGIN
  IF NOT type_exists('training_type_enum') THEN
    CREATE TYPE "public"."training_type_enum" AS ENUM('main', 'reserve', 'personal');
  END IF;
END$$;

-- Create userprofile_role_enum if it doesn't exist
DO $$
BEGIN
  IF NOT type_exists('userprofile_role_enum') THEN
    CREATE TYPE "public"."userprofile_role_enum" AS ENUM('admin', 'staff_member', 'guest', 'client');
  END IF;
END$$;

-- Create userprofile_status_enum if it doesn't exist
DO $$
BEGIN
  IF NOT type_exists('userprofile_status_enum') THEN
    CREATE TYPE "public"."userprofile_status_enum" AS ENUM('active', 'inactive', 'not_verified', 'blocked');
  END IF;
END$$;
