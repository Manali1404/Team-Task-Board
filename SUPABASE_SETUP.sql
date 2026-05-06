-- Add tag column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS tag text NOT NULL DEFAULT 'Internal' CHECK (tag IN ('Internal','Client ready','Client support needed'));

-- Update status constraint to include 'blocked'
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo','in-progress','in-review','done','blocked'));
