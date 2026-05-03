-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Nov 27, 2025 at 08:24 AM
-- Server version: 8.3.0
-- PHP Version: 8.3.7

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `repair_job_portal`
--

-- --------------------------------------------------------

--
-- Table structure for table `chats`
--

CREATE TABLE `chats` (
  `id` int NOT NULL,
  `repair_job_id` int DEFAULT NULL,
  `sender_id` int NOT NULL,
  `sender_role` enum('user','customer','system') NOT NULL,
  `message` text,
  `is_read` tinyint(1) DEFAULT '0',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int NOT NULL,
  `organization_id` int NOT NULL,
  `company_name` varchar(150) NOT NULL,
  `store_code` varchar(50) DEFAULT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `contact_person_name` varchar(150) DEFAULT NULL,
  `contact_person_email` varchar(100) DEFAULT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `role` varchar(10) NOT NULL DEFAULT 'Customer',
  `return_address` varchar(255) DEFAULT NULL,
  `warranty_months` int DEFAULT '0',
  `warranty_type` varchar(50) DEFAULT NULL,
  `doa_warranty_days` int DEFAULT '0',
  `doa_warranty_type` varchar(50) DEFAULT NULL,
  `warranty_remarks` varchar(255) DEFAULT NULL,
  `is_pickup_faulty` tinyint NOT NULL DEFAULT '0',
  `sales_person` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_locked` tinyint(1) NOT NULL DEFAULT '0',
  `activation_token` varchar(255) DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `organization_id`, `company_name`, `store_code`, `email`, `password`, `contact_person_name`, `contact_person_email`, `mobile`, `role`, `return_address`, `warranty_months`, `warranty_type`, `doa_warranty_days`, `doa_warranty_type`, `warranty_remarks`, `is_pickup_faulty`, `sales_person`, `is_active`, `is_locked`, `activation_token`, `created_date`, `updated_date`) VALUES
(1, 1, 'Techcrazy_NZ', 'NZRA01', 'rmaapple08@gmail.com', '$2b$10$zTixiMFQs0Bwg7in.WnG2.ClzLfgNkVWvKxJ5c7DZOm1y6T8YJfUu', 'Jitender', 'rmaapple08@gmail.com', '1234567890', 'Customer', 'Opposite Papatoetoe Fire Station 16 Lambie Drive, ...', NULL, 'No Warranty', NULL, 'From KTC Invoice Date', 'Only DOA warranty need to be given', 0, 'Jules Mckenzie', 1, 0, NULL, '2025-11-14 15:56:30', '2025-11-23 23:30:19'),
(2, 1, 'PB Tech', 'NZRA02', 'PBTech@gmail.com', '$2b$10$E/ikpJWeI4MX/yMKacYC3O.ECiYMgqL8JeiugOOr2pvRU8n6p7dFm', 'Eidde', 'Eddiw@gmail.com', '1234567891', 'Customer', 'Manuka, Auckland, NZ', 12, 'From Customer Sales Date', 14, 'From Customer Sales Date', 'try to repair the product first.', 0, 'Jules Mckenzie', 0, 1, 'trQzm2g4NwPggpI0jZzHL3uE90OhMO9KopCkmTrvOCTmWpY113hSOrL', '2025-11-15 16:41:27', '2025-11-15 16:57:14'),
(3, 2, 'Heathcotes', 'NZCRRA03', 'Heathcotes@gmail.com', '$2b$10$B8xKElr7yG5OAKy.EFys4eiEYM/mBq2IG9wIMCPNtC/tpvlusGzIq', 'Sam', 'sam@gmail.com', '1234567892', 'Customer', 'Hamilton, NZ', 12, 'From Customer Sales Date', 14, 'From Customer Sales Date', 'try to repair the product first.', 0, 'Andy Sen', 0, 1, 'H8trsoJFTMHi90rYQ1kyBGSeVrGKqmCLLzlEpLbkmreNjpNPWWd2pzy', '2025-11-15 16:48:17', '2025-11-15 16:57:18'),
(4, 2, 'ACIEM', 'NZCRRA04', 'ACIEM@gmail.com', '$2b$10$jAPMiXrxnw8jYR/i6sgMQ.kOezMIg6sFfY4vMc4.pQ4cTuKJRRZNy', 'Malissa', 'Malissa@gmail.com', '1234567893', 'Customer', 'Auckland, NZ', 12, 'From Customer Sales Date', 14, 'From Customer Sales Date', 'try to repair the product first.', 0, 'Andy Sen', 0, 1, 'eNpvfpo2L81pm9V6h2rhWGG9NE0hGJQXxf4qLUQBsOZ7zYHB1OxdFeM', '2025-11-15 16:52:21', '2025-11-15 16:56:30'),
(5, 2, 'Vinod Patel', 'NZCRRA05', 'VP@gmail.com', '$2b$10$Ve12iEMnUgysSyiUzaJ.wuvQhEDAlK69bBliEgE12KRZg138Bafgq', 'Ravinesh', 'R@gmail.com', '1234567894', 'Customer', 'Suva, Fiji', 12, 'From Customer Sales Date', 14, 'From Customer Sales Date', 'try to repair the product first.', 0, 'Andy Sen', 0, 1, 'tHwsV8hnRaZPi6H54NG90rK7uRLBEguqkiU8Fm0JXH7qLwhBdjWFRgc', '2025-11-15 16:58:31', '2025-11-15 16:58:31');

-- --------------------------------------------------------

--
-- Table structure for table `documents`
--

CREATE TABLE `documents` (
  `id` int NOT NULL,
  `repair_job_id` int NOT NULL,
  `related_type` varchar(50) NOT NULL COMMENT 'repair_job, repair_comment, chat, credit_note, replacement_order, courier_ticket, customer, vendor, etc.',
  `related_id` int NOT NULL COMMENT 'id of the related entity',
  `document_name` varchar(255) NOT NULL,
  `document_url` varchar(500) NOT NULL,
  `document_type` varchar(50) DEFAULT NULL COMMENT 'image, pdf, doc, video, other',
  `uploaded_by` int DEFAULT NULL,
  `uploaded_role` varchar(50) DEFAULT NULL,
  `file_hash` varchar(128) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `uploaded_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int NOT NULL,
  `organization_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `customer_id` int DEFAULT NULL,
  `reference_type` varchar(50) DEFAULT NULL,
  `reference_id` int DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `message` text,
  `is_read` tinyint(1) DEFAULT '0',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `organizations`
--

CREATE TABLE `organizations` (
  `id` int NOT NULL,
  `name` varchar(150) NOT NULL,
  `alias` varchar(30) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `organizations`
--

INSERT INTO `organizations` (`id`, `name`, `alias`, `address`, `email`, `phone`, `is_active`, `created_date`, `updated_date`) VALUES
(1, 'KTC World HQ', 'NZRA', 'Unit 4, 14 Northside Drive, Whenuapai, Auckland 0814', 'info@ktcgroupltd.com', '098323262', 1, '2025-11-14 11:55:55', '2025-11-14 15:25:13'),
(2, 'KTC Cooporate and Reward', 'NZCRRA', '4/14 northside road,westgate,auckalnd', 'admin.cr@ktcgroupltd.com', '092341234', 1, '2025-11-15 16:45:30', '2025-11-15 16:45:30'),
(3, 'KTC Australia', 'AURA', '4/14 northside road,westgate,auckalnd', 'admin.au@ktcgroupltd.com', '092341234', 1, '2025-11-15 16:45:54', '2025-11-15 16:45:54');

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int NOT NULL,
  `organization_id` int NOT NULL,
  `sku` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `model` varchar(100) DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `product_serials`
--

CREATE TABLE `product_serials` (
  `id` int NOT NULL,
  `organization_id` int NOT NULL,
  `product_id` int NOT NULL,
  `serial_number` varchar(100) NOT NULL,
  `sales_invoice` varchar(100) DEFAULT NULL,
  `sale_date` date DEFAULT NULL,
  `warranty_expiry` date DEFAULT NULL,
  `is_replacement` tinyint(1) DEFAULT '0',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `repair_jobs`
--

CREATE TABLE `repair_jobs` (
  `id` int NOT NULL,
  `ra_job_id` varchar(50) NOT NULL,
  `batch_id` varchar(30) DEFAULT NULL,
  `organization_id` int NOT NULL,
  `customer_id` int NOT NULL,
  `product_id` int DEFAULT NULL,
  `sku` varchar(50) DEFAULT NULL,
  `product_name` varchar(255) DEFAULT NULL,
  `serial_number` varchar(100) DEFAULT NULL,
  `serial_number_id` int DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `device_password` varchar(128) DEFAULT NULL,
  `is_doa` tinyint(1) DEFAULT '0',
  `is_product_under_warranty` tinyint(1) DEFAULT '0',
  `is_product_working` tinyint(1) DEFAULT '1',
  `cloud_status` tinyint(1) DEFAULT '0',
  `cloud_details` varchar(255) DEFAULT NULL,
  `product_fault` text,
  `video_url` varchar(255) DEFAULT NULL,
  `customer_tracking_number` varchar(100) DEFAULT NULL,
  `dispatch_id` varchar(100) DEFAULT NULL,
  `item_status` enum('pending','in_progress','repaired','replaced','returned','written_off') DEFAULT 'pending',
  `sales_invoice` varchar(100) DEFAULT NULL,
  `customer_sales_invoice` varchar(50) NOT NULL,
  `customer_job_no` varchar(100) DEFAULT NULL,
  `resolution_type` enum('replacement','credit','repair') DEFAULT 'repair',
  `job_status` enum('created','received','in_progress','waiting_parts','completed','closed','cancelled') DEFAULT 'created',
  `created_by` int NOT NULL,
  `created_role_by` varchar(50) DEFAULT NULL,
  `received_by` int DEFAULT NULL,
  `received_role_by` varchar(50) DEFAULT NULL,
  `received_date` datetime DEFAULT NULL,
  `due_date` datetime DEFAULT NULL,
  `completion_date` datetime DEFAULT NULL,
  `vendor_id` int DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `repair_job_audit_logs`
--

CREATE TABLE `repair_job_audit_logs` (
  `id` int NOT NULL,
  `repair_job_id` int DEFAULT NULL,
  `action_type` enum('CREATE','UPDATE','DELETE','STATUS_CHANGE','COMMENT','CONTACT','COST_CHANGE') NOT NULL,
  `description` text,
  `performed_by` int DEFAULT NULL,
  `performed_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `repair_job_comments`
--

CREATE TABLE `repair_job_comments` (
  `id` int NOT NULL,
  `repair_job_id` int NOT NULL,
  `user_id` int NOT NULL,
  `visibility` enum('internal','add note') DEFAULT 'internal',
  `comment` text NOT NULL,
  `is_edit` tinyint NOT NULL DEFAULT '0',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `repair_job_costings`
--

CREATE TABLE `repair_job_costings` (
  `id` int NOT NULL,
  `repair_job_id` int NOT NULL,
  `charge_type` enum('repair','replacement','shipping','credit','other') DEFAULT 'repair',
  `replacement_product_sku` varchar(50) DEFAULT NULL,
  `replacement_serial_number` varchar(100) DEFAULT NULL,
  `replacement_serial_id` int DEFAULT NULL,
  `replacement_cost` decimal(12,2) DEFAULT NULL,
  `remaining_warranty_months` int DEFAULT NULL,
  `temp_credit_note_number` varchar(100) DEFAULT NULL,
  `credit_note_number` varchar(100) DEFAULT NULL,
  `credit_amount` decimal(12,2) DEFAULT NULL,
  `repair_details` text,
  `repair_part_cost` decimal(12,2) DEFAULT NULL,
  `repair_labour_cost` decimal(12,2) DEFAULT NULL,
  `shipping_cost` decimal(12,2) DEFAULT NULL,
  `tracking_number` varchar(100) DEFAULT NULL,
  `performed_by` int DEFAULT NULL,
  `performed_date` datetime DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `repair_job_tracking`
--

CREATE TABLE `repair_job_tracking` (
  `id` int NOT NULL,
  `repair_job_id` int NOT NULL,
  `previous_status` varchar(100) DEFAULT NULL,
  `new_status` varchar(100) NOT NULL,
  `note` text,
  `assigned_technician_id` int DEFAULT NULL,
  `changed_by` int NOT NULL,
  `changed_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `session_managements`
--

CREATE TABLE `session_managements` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `jwt_token` varchar(800) NOT NULL,
  `refresh_token` varchar(800) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `session_managements`
--

INSERT INTO `session_managements` (`id`, `user_id`, `jwt_token`, `refresh_token`, `created_date`) VALUES
(2, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJybWFhcHBsZTA4QGdtYWlsLmNvbSIsImlhdCI6MTc2MzA5NTgwNCwiZXhwIjoxNzYzMTAzMDA0fQ.5Ym3g_SjTRq9qWKYv6z1BBET64-4cNPnz2mHolP0M1g', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzMDk1ODA1LCJleHAiOjE3NjM5NTk4MDV9.qStnxA6CHwHla1K2GiFOnANgH4eE4Hips5jJD2qrjpA', '2025-11-14 17:50:09'),
(3, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJybWFhcHBsZTA4QGdtYWlsLmNvbSIsImlhdCI6MTc2MzExMzE2OCwiZXhwIjoxNzYzMTIwMzY4fQ.XsEULWhcP4ZvuysTH5ckNLrgL907FOr291xZcHavOBY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzMTEzMTY4LCJleHAiOjE3NjM5NzcxNjh9.v7jQmP51goM16MeRhFqA_xkUzI8zH9CmIIUqXtPSqvs', '2025-11-14 22:39:28'),
(4, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJybWFhcHBsZTA4QGdtYWlsLmNvbSIsImlhdCI6MTc2MzExMzM5MiwiZXhwIjoxNzYzMTIwNTkyfQ.AO_Zt2PLZfOH6wtyXu1FwffGGgjI1J9L5ldb0C1UEKY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzMTEzMzkyLCJleHAiOjE3NjM5NzczOTJ9.Chz2_y6i_aS2a29tdHJrfkws6yr_f5a3rm62sB-hMxs', '2025-11-14 22:43:12'),
(5, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJybWFhcHBsZTA4QGdtYWlsLmNvbSIsImlhdCI6MTc2MzE1OTMxNywiZXhwIjoxNzYzMTY2NTE3fQ.TXojrINyjxpfYCO0jpwQi78utxKRIXsOunu1izCnERA', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzMTU5MzE3LCJleHAiOjE3NjQwMjMzMTd9.WI68Ic2EsEDirVOhh0yaAEXK6Ort_d2jKxtzxYIHQbQ', '2025-11-15 11:28:37'),
(6, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJybWFhcHBsZTA4QGdtYWlsLmNvbSIsImlhdCI6MTc2MzE3ODAwMywiZXhwIjoxNzYzMTg1MjAzfQ.lrk2w47UwPzAr_INcCt9zcFC69C1t-2ZaV3eCX--d0w', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzMTc4MDAzLCJleHAiOjE3NjQwNDIwMDN9.DWdr7W1gGKSREMnjf_P7V5E4MvteR1wiNsgJla1NYDg', '2025-11-15 16:40:03'),
(7, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJvbmVAb25lLmNvbSIsImlhdCI6MTc2MzE4NTczMiwiZXhwIjoxNzYzMTkyOTMyfQ.6KLz7zEF4y2HWKCLLA6N5SKAl3VODGZ1CM4rWu2SdmQ', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzMTg1NzMyLCJleHAiOjE3NjQwNDk3MzJ9.ZUk-VnMVo7MBe8j3d3OOTDMjqnbLr5EyST79TH__rcc', '2025-11-15 18:48:57'),
(8, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJvbmVAb25lLmNvbSIsImlhdCI6MTc2MzE4ODQ2MiwiZXhwIjoxNzYzMTk1NjYyfQ.uAAqzqybMmgXMh-SbIVv_KBAaTDqQ7YkQBMK0lmePxY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzMTg4NDYyLCJleHAiOjE3NjQwNTI0NjJ9.ztVeFVDYp9PmWfTabflwAbRBT4NZM2aynPNdw37cGec', '2025-11-15 19:34:22'),
(9, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJvbmVAb25lLmNvbSIsImlhdCI6MTc2MzE5NjM0OSwiZXhwIjoxNzYzMjAzNTQ5fQ.3Cran8byYDYsxpi9j13m4KSjuY5SVjOny4rQLrIT9ak', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzMTk2MzQ5LCJleHAiOjE3NjQwNjAzNDl9.bGHSf67HUELdxicZB-vsB5vTcrHP4W2m61d9-ciUEPo', '2025-11-15 21:45:49'),
(10, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJvbmVAb25lLmNvbSIsImlhdCI6MTc2MzE5ODM1MiwiZXhwIjoxNzYzMjA1NTUyfQ.TLzwQk7IzvH1NH7mht55zpR8UuhMma8PUR8ev3cOnno', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzMTk4MzUyLCJleHAiOjE3NjQwNjIzNTJ9.MGrHGSJFQBsyrSSeTanu3IUDMd4GAqGs2mfk_BEJfz8', '2025-11-15 22:19:12'),
(11, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJvbmVAb25lLmNvbSIsImlhdCI6MTc2MzIwMjI4MCwiZXhwIjoxNzYzMjA5NDgwfQ.-Z0-r6I4P-FF9G4AurLAa6EzI9rcRA_eVrhgqMDp22o', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzMjAyMjgwLCJleHAiOjE3NjQwNjYyODB9.KLUS8IcAUGV5ussyjL-dknRQS0U3su8Wt691f-snp4s', '2025-11-15 23:24:40'),
(12, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJvbmVAb25lLmNvbSIsImlhdCI6MTc2MzI3NTUwMCwiZXhwIjoxNzYzMjgyNzAwfQ.MR-WnmMMzPe4p7Vevv-ADmyM3QfxqqfXIPJiY9ocYG4', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzMjc1NTAwLCJleHAiOjE3NjQxMzk1MDB9.yX8k86l3470T1rrjseRjilPE1tqACawbAcpKxc9pGhA', '2025-11-16 19:45:00'),
(13, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJvbmVAb25lLmNvbSIsImlhdCI6MTc2Mzg4NDAwNywiZXhwIjoxNzYzODkxMjA3fQ.cS6SBi4r_a8Yx5yEyp8-Y9LaR3JNluJ7ke75Ss7MPZc', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzODg0MDA3LCJleHAiOjE3NjQ3NDgwMDd9.pOISxyKVJRD_d2B-7-6fpotJaSkRL-ARK_okpVg-V0Y', '2025-11-23 20:46:47'),
(14, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJvbmVAb25lLmNvbSIsImlhdCI6MTc2Mzg4NDA4MywiZXhwIjoxNzYzODkxMjgzfQ.RPNy1Tpbt41IPxZaV_BBa9MUQLB5dvJp5uDG7rQCG68', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzODg0MDgzLCJleHAiOjE3NjQ3NDgwODN9.6-wUg4BcPGyuTqho1pbTzXxapPvsKeLlh0fozPO2Ejs', '2025-11-23 20:48:03'),
(15, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJvbmVAb25lLmNvbSIsImlhdCI6MTc2Mzg4OTA4MCwiZXhwIjoxNzYzODk2MjgwfQ.0xnswL2NtzVh3L3gGpnwLcbyLodOz1_gsHy4wmbz1u4', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzODg5MDgwLCJleHAiOjE3NjQ3NTMwODB9.kJI0M783LnnTG7vbAZ8sMRRdl29pxG0ucgvmBsXb5ks', '2025-11-23 22:11:20'),
(16, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJvbmVAb25lLmNvbSIsImlhdCI6MTc2Mzg5Mzg0MSwiZXhwIjoxNzYzOTAxMDQxfQ.gNxRfJx_cTlo4EOd9V6eJcyqr4XBF9AE5oniOUg4HGA', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzODkzODQxLCJleHAiOjE3NjQ3NTc4NDF9.secRfa62nwFWzQEIFMw6lhYAhi-JKY8c21nXA3mqS5Y', '2025-11-23 23:30:41'),
(17, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJvbmVAb25lLmNvbSIsImlhdCI6MTc2Mzk3MDM5MSwiZXhwIjoxNzYzOTc3NTkxfQ.Gsd_EL_B_ADrlxR3pa0VFj1cXEAl02rfvP7ue8ESLCY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzOTcwMzkxLCJleHAiOjE3NjQ4MzQzOTF9.GecunEfJQycxXoZ1fnFrDIVlO7kC4I4T7sqWTh21l60', '2025-11-24 20:46:31'),
(18, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJvbmVAb25lLmNvbSIsImlhdCI6MTc2Mzk3MDYzNywiZXhwIjoxNzYzOTc3ODM3fQ.5yx79FuyM8HCVG6JFsI0fyk0MonYSJAY6cQvq9fkngw', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzOTcwNjM3LCJleHAiOjE3NjQ4MzQ2Mzd9.Xlbk4onVHr7fT8mTCChWxN-R6HCLMfEDm_qwrB01r4o', '2025-11-24 20:50:37'),
(19, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJvbmVAb25lLmNvbSIsImlhdCI6MTc2Mzk3MTQxMCwiZXhwIjoxNzYzOTc4NjEwfQ.9RFXj2dXZzpX8tc1rixAnAeQBSLgq2ZDNd-KTCWl3qU', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzOTcxNDEwLCJleHAiOjE3NjQ4MzU0MTB9.21J3_0Huuvkr_XfMaIU_A95DawkMSRJJ4TFJEqMuXrE', '2025-11-24 21:03:30'),
(20, 1, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJvbmVAb25lLmNvbSIsImlhdCI6MTc2Mzk3MTQ0OCwiZXhwIjoxNzYzOTc4NjQ4fQ.6BmfgZBmXXnQd9fVYzg9oSX9SYETxIFkqUCwOn3i3S8', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiaWF0IjoxNzYzOTcxNDQ4LCJleHAiOjE3NjQ4MzU0NDh9.K9-UQNRDtzvwYCE_nuzp-gVnnoNkN2pyGXnrO06sHV8', '2025-11-24 21:04:08');

-- --------------------------------------------------------

--
-- Table structure for table `system_logs`
--

CREATE TABLE `system_logs` (
  `id` int NOT NULL,
  `actor_id` int NOT NULL,
  `actor_role` varchar(20) NOT NULL,
  `description` varchar(500) NOT NULL,
  `log_status` varchar(20) NOT NULL,
  `created_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `system_logs`
--

INSERT INTO `system_logs` (`id`, `actor_id`, `actor_role`, `description`, `log_status`, `created_date`) VALUES
(1, 1, 'customer', 'Techcrazy_NZ  account is activated.', 'Successful', '2025-11-14 17:19:22'),
(2, 1, 'customer', 'Techcrazy_NZ password has been changed.', 'Successful', '2025-11-14 17:35:04'),
(3, 1, 'customer', 'Techcrazy_NZ login into the system.', 'Successful', '2025-11-14 17:50:13'),
(4, 1, 'customer', 'Techcrazy_NZ login into the system.', 'Successful', '2025-11-14 22:39:28'),
(5, 1, 'customer', 'Techcrazy_NZ did the logout', 'Successful', '2025-11-14 22:42:55'),
(6, 1, 'customer', 'Techcrazy_NZ login into the system.', 'Successful', '2025-11-14 22:43:12'),
(7, 1, 'customer', 'Techcrazy_NZ login into the system.', 'Successful', '2025-11-15 11:28:37'),
(8, 1, 'customer', 'Techcrazy_NZ login into the system.', 'Successful', '2025-11-15 16:40:03'),
(9, 1, 'Admin', 'one one is registered. ', 'Successful', '2025-11-15 18:29:22'),
(10, 1, 'Admin', 'one one is login. ', 'Successful', '2025-11-15 18:49:01'),
(11, 1, 'Admin', 'one one is activated', 'Successful', '2025-11-15 19:34:07'),
(12, 1, 'Admin', 'one one is login. ', 'Successful', '2025-11-15 19:34:22'),
(13, 1, 'Admin', 'one one is login. ', 'Successful', '2025-11-15 21:45:49'),
(14, 1, 'Admin', 'one one did the logout', 'Successful', '2025-11-15 21:47:04'),
(15, 1, 'Admin', 'one one is login. ', 'Successful', '2025-11-15 22:19:12'),
(16, 1, 'Admin', 'one one is login. ', 'Successful', '2025-11-15 23:24:40'),
(17, 1, 'Admin', 'one one has activated the user one one', 'Successful', '2025-11-15 23:27:23'),
(18, 1, 'Admin', 'one one has deactivated the user one one', 'Successful', '2025-11-15 23:27:56'),
(19, 1, 'Admin', 'one one has activated the user one one', 'Successful', '2025-11-15 23:28:18'),
(20, 1, 'Admin', 'one one is login. ', 'Successful', '2025-11-16 19:45:00'),
(21, 1, 'Admin', 'one one update the detail of user_id 1', 'Successful', '2025-11-16 19:57:34'),
(22, 1, 'Admin', 'one one update the detail of user_id 1', 'Successful', '2025-11-16 19:58:02'),
(23, 1, 'Admin', 'one one update the detail of user_id 1', 'Successful', '2025-11-16 19:58:21'),
(24, 1, 'Admin', 'one one is login. ', 'Successful', '2025-11-23 20:46:47'),
(25, 1, 'Admin', 'one one is login. ', 'Successful', '2025-11-23 20:48:03'),
(26, 1, 'Admin', 'one one is login. ', 'Successful', '2025-11-23 22:11:20'),
(27, 1, 'Admin', 'one one is login. ', 'Successful', '2025-11-23 23:30:41'),
(28, 1, 'Admin', 'one one is login. ', 'Successful', '2025-11-24 20:46:31'),
(29, 1, 'Admin', 'one one is login. ', 'Successful', '2025-11-24 20:50:37'),
(30, 1, 'Admin', 'one one is login. ', 'Successful', '2025-11-24 21:03:30'),
(31, 1, 'Admin', 'one one is login. ', 'Successful', '2025-11-24 21:04:08'),
(32, 2, 'Admin', 'two two is registered. ', 'Successful', '2025-11-24 21:47:01');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `role` enum('Super Admin','Admin','Technician') NOT NULL DEFAULT 'Admin',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_locked` tinyint(1) NOT NULL DEFAULT '0',
  `activation_token` varchar(255) DEFAULT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_date` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `first_name`, `last_name`, `email`, `password`, `mobile`, `role`, `is_active`, `is_locked`, `activation_token`, `created_date`, `updated_date`) VALUES
(1, 'one', 'one', 'one@one.com', '$2b$10$.FsqGuFXvwg/CUwZ.r9Qze2Tqana0.eTGCdGapqoOeRacL/SGduxq', '0210286611', 'Admin', 1, 0, NULL, '2025-11-15 18:29:13', '2025-11-16 19:58:21'),
(2, 'two', 'two', 'teo@two.com', '$2b$10$WZFohd0MhEB224EN66fNFuKwnNB.0RTMnoStPIrv/PlFmW6sJCY8W', '0210286601', 'Admin', 0, 1, 'O7Zu7ZFTE5Gd0UbSIhq4XTEldVJm5n2hpFvtFuqAeduwdDaRL8NhrUJ', '2025-11-24 21:47:01', '2025-11-24 21:47:01');

-- --------------------------------------------------------

--
-- Table structure for table `user_customers`
--

CREATE TABLE `user_customers` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `customer_id` int NOT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `user_customers`
--

INSERT INTO `user_customers` (`id`, `user_id`, `customer_id`, `created_date`) VALUES
(30, 1, 1, '2025-11-16 19:58:21'),
(31, 1, 2, '2025-11-16 19:58:21'),
(32, 1, 3, '2025-11-16 19:58:21'),
(33, 1, 4, '2025-11-16 19:58:21'),
(34, 1, 5, '2025-11-16 19:58:21'),
(35, 2, 1, '2025-11-24 21:47:01'),
(36, 2, 2, '2025-11-24 21:47:01'),
(37, 2, 3, '2025-11-24 21:47:01'),
(38, 2, 4, '2025-11-24 21:47:01'),
(39, 2, 5, '2025-11-24 21:47:01');

-- --------------------------------------------------------

--
-- Table structure for table `user_organizations`
--

CREATE TABLE `user_organizations` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `organization_id` int NOT NULL,
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `user_organizations`
--

INSERT INTO `user_organizations` (`id`, `user_id`, `organization_id`, `created_date`) VALUES
(9, 1, 1, '2025-11-16 19:58:21'),
(10, 1, 2, '2025-11-16 19:58:21'),
(11, 1, 3, '2025-11-16 19:58:21'),
(12, 2, 1, '2025-11-24 21:47:01'),
(13, 2, 2, '2025-11-24 21:47:01');

-- --------------------------------------------------------

--
-- Table structure for table `vendors`
--

CREATE TABLE `vendors` (
  `id` int NOT NULL,
  `organization_id` int NOT NULL,
  `vendor_name` varchar(150) NOT NULL,
  `contact_person` varchar(150) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_date` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `chats`
--
ALTER TABLE `chats`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_chats_job` (`repair_job_id`),
  ADD KEY `idx_chats_sender` (`sender_id`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_customers_org` (`organization_id`);

--
-- Indexes for table `documents`
--
ALTER TABLE `documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_documents_related` (`related_type`,`related_id`),
  ADD KEY `idx_documents_uploaded_by` (`uploaded_by`),
  ADD KEY `idx_repair_job_id` (`repair_job_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notifications_user` (`user_id`),
  ADD KEY `idx_notifications_customer` (`customer_id`),
  ADD KEY `idx_notifications_org` (`organization_id`);

--
-- Indexes for table `organizations`
--
ALTER TABLE `organizations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ux_organizations_alias` (`alias`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ux_products_org_sku` (`organization_id`,`sku`);

--
-- Indexes for table `product_serials`
--
ALTER TABLE `product_serials`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ux_product_serial` (`product_id`,`serial_number`),
  ADD KEY `idx_serials_org` (`organization_id`),
  ADD KEY `idx_serials_product` (`product_id`);

--
-- Indexes for table `repair_jobs`
--
ALTER TABLE `repair_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ux_repair_jobs_ra_job_id` (`ra_job_id`),
  ADD KEY `idx_jobs_org_status` (`organization_id`,`job_status`),
  ADD KEY `idx_jobs_customer` (`customer_id`),
  ADD KEY `idx_jobs_product` (`product_id`),
  ADD KEY `idx_jobs_serial` (`serial_number`),
  ADD KEY `fk_repair_jobs_vendor` (`vendor_id`),
  ADD KEY `fk_repair_jobs_serial` (`serial_number_id`);

--
-- Indexes for table `repair_job_audit_logs`
--
ALTER TABLE `repair_job_audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_audit_job` (`repair_job_id`),
  ADD KEY `idx_audit_performed_by` (`performed_by`);

--
-- Indexes for table `repair_job_comments`
--
ALTER TABLE `repair_job_comments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_comments_job` (`repair_job_id`),
  ADD KEY `idx_comments_user` (`user_id`);

--
-- Indexes for table `repair_job_costings`
--
ALTER TABLE `repair_job_costings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_costs_job` (`repair_job_id`),
  ADD KEY `idx_costs_replacement_serial` (`replacement_serial_id`);

--
-- Indexes for table `repair_job_tracking`
--
ALTER TABLE `repair_job_tracking`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_tracking_job` (`repair_job_id`),
  ADD KEY `idx_tracking_tech` (`assigned_technician_id`);

--
-- Indexes for table `session_managements`
--
ALTER TABLE `session_managements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_session_user` (`user_id`);

--
-- Indexes for table `system_logs`
--
ALTER TABLE `system_logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ux_users_email` (`email`);

--
-- Indexes for table `user_customers`
--
ALTER TABLE `user_customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ux_user_customers` (`customer_id`,`user_id`),
  ADD KEY `idx_uc_user` (`user_id`);

--
-- Indexes for table `user_organizations`
--
ALTER TABLE `user_organizations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `ux_user_organizations` (`user_id`,`organization_id`),
  ADD KEY `idx_uo_org` (`organization_id`);

--
-- Indexes for table `vendors`
--
ALTER TABLE `vendors`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_vendors_org` (`organization_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `chats`
--
ALTER TABLE `chats`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `documents`
--
ALTER TABLE `documents`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `organizations`
--
ALTER TABLE `organizations`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `product_serials`
--
ALTER TABLE `product_serials`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `repair_jobs`
--
ALTER TABLE `repair_jobs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `repair_job_audit_logs`
--
ALTER TABLE `repair_job_audit_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `repair_job_comments`
--
ALTER TABLE `repair_job_comments`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `repair_job_costings`
--
ALTER TABLE `repair_job_costings`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `repair_job_tracking`
--
ALTER TABLE `repair_job_tracking`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `session_managements`
--
ALTER TABLE `session_managements`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `system_logs`
--
ALTER TABLE `system_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=33;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `user_customers`
--
ALTER TABLE `user_customers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=40;

--
-- AUTO_INCREMENT for table `user_organizations`
--
ALTER TABLE `user_organizations`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `vendors`
--
ALTER TABLE `vendors`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `chats`
--
ALTER TABLE `chats`
  ADD CONSTRAINT `fk_chats_job` FOREIGN KEY (`repair_job_id`) REFERENCES `repair_jobs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_chats_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `customers`
--
ALTER TABLE `customers`
  ADD CONSTRAINT `fk_customers_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `documents`
--
ALTER TABLE `documents`
  ADD CONSTRAINT `fk_documents_uploaded_by` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notifications_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_notifications_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `fk_products_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `product_serials`
--
ALTER TABLE `product_serials`
  ADD CONSTRAINT `fk_serials_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_serials_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `repair_jobs`
--
ALTER TABLE `repair_jobs`
  ADD CONSTRAINT `fk_repair_jobs_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_repair_jobs_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_repair_jobs_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_repair_jobs_serial` FOREIGN KEY (`serial_number_id`) REFERENCES `product_serials` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_repair_jobs_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `repair_job_audit_logs`
--
ALTER TABLE `repair_job_audit_logs`
  ADD CONSTRAINT `fk_audit_logs_job` FOREIGN KEY (`repair_job_id`) REFERENCES `repair_jobs` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_audit_logs_user` FOREIGN KEY (`performed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `repair_job_comments`
--
ALTER TABLE `repair_job_comments`
  ADD CONSTRAINT `fk_comments_job` FOREIGN KEY (`repair_job_id`) REFERENCES `repair_jobs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_comments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `repair_job_costings`
--
ALTER TABLE `repair_job_costings`
  ADD CONSTRAINT `fk_costs_job` FOREIGN KEY (`repair_job_id`) REFERENCES `repair_jobs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_costs_replace_serial` FOREIGN KEY (`replacement_serial_id`) REFERENCES `product_serials` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `repair_job_tracking`
--
ALTER TABLE `repair_job_tracking`
  ADD CONSTRAINT `fk_tracking_job` FOREIGN KEY (`repair_job_id`) REFERENCES `repair_jobs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_tracking_tech` FOREIGN KEY (`assigned_technician_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `user_customers`
--
ALTER TABLE `user_customers`
  ADD CONSTRAINT `fk_user_customers_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_user_customers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `user_organizations`
--
ALTER TABLE `user_organizations`
  ADD CONSTRAINT `fk_user_organizations_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_user_organizations_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `vendors`
--
ALTER TABLE `vendors`
  ADD CONSTRAINT `fk_vendors_org` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
