<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20251103ScenarioOptions extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add per-scenario execution options (screenshots, retries, backoff, timeout, dsf, userAgent)';
    }

    public function up(Schema $schema): void
    {
        if (!$schema->hasTable('test_scenario')) { return; }
        $table = $schema->getTable('test_scenario');
        if (!$table->hasColumn('per_step_screenshot')) {
            $this->addSql('ALTER TABLE test_scenario ADD per_step_screenshot TINYINT(1) DEFAULT 1 NOT NULL');
        }
        if (!$table->hasColumn('screenshot_full_page')) {
            $this->addSql('ALTER TABLE test_scenario ADD screenshot_full_page TINYINT(1) DEFAULT 0 NOT NULL');
        }
        if (!$table->hasColumn('retries')) {
            $this->addSql('ALTER TABLE test_scenario ADD retries INT DEFAULT 1 NOT NULL');
        }
        if (!$table->hasColumn('backoff_ms')) {
            $this->addSql('ALTER TABLE test_scenario ADD backoff_ms INT DEFAULT 500 NOT NULL');
        }
        if (!$table->hasColumn('step_timeout_ms')) {
            $this->addSql('ALTER TABLE test_scenario ADD step_timeout_ms INT DEFAULT 10000 NOT NULL');
        }
        if (!$table->hasColumn('device_scale_factor')) {
            $this->addSql('ALTER TABLE test_scenario ADD device_scale_factor INT DEFAULT 2 NOT NULL');
        }
        if (!$table->hasColumn('user_agent')) {
            $this->addSql('ALTER TABLE test_scenario ADD user_agent VARCHAR(255) DEFAULT NULL');
        }
    }

    public function down(Schema $schema): void
    {
        if (!$schema->hasTable('test_scenario')) { return; }
        $table = $schema->getTable('test_scenario');
        if ($table->hasColumn('per_step_screenshot')) {
            $this->addSql('ALTER TABLE test_scenario DROP per_step_screenshot');
        }
        if ($table->hasColumn('screenshot_full_page')) {
            $this->addSql('ALTER TABLE test_scenario DROP screenshot_full_page');
        }
        if ($table->hasColumn('retries')) {
            $this->addSql('ALTER TABLE test_scenario DROP retries');
        }
        if ($table->hasColumn('backoff_ms')) {
            $this->addSql('ALTER TABLE test_scenario DROP backoff_ms');
        }
        if ($table->hasColumn('step_timeout_ms')) {
            $this->addSql('ALTER TABLE test_scenario DROP step_timeout_ms');
        }
        if ($table->hasColumn('device_scale_factor')) {
            $this->addSql('ALTER TABLE test_scenario DROP device_scale_factor');
        }
        if ($table->hasColumn('user_agent')) {
            $this->addSql('ALTER TABLE test_scenario DROP user_agent');
        }
    }
}
