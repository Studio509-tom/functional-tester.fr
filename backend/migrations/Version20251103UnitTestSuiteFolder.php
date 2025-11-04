<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20251103UnitTestSuiteFolder extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add optional folder relation to unit_test_suite';
    }

    public function up(Schema $schema): void
    {
        if ($schema->hasTable('unit_test_suite') && !$schema->getTable('unit_test_suite')->hasColumn('folder_id')) {
            $this->addSql('ALTER TABLE unit_test_suite ADD folder_id INT DEFAULT NULL');
            $this->addSql('ALTER TABLE unit_test_suite ADD CONSTRAINT FK_UNIT_SUITE_FOLDER FOREIGN KEY (folder_id) REFERENCES scenario_folder (id) ON DELETE SET NULL');
            $this->addSql('CREATE INDEX IDX_UNIT_SUITE_FOLDER ON unit_test_suite (folder_id)');
        }
    }

    public function down(Schema $schema): void
    {
        if ($schema->hasTable('unit_test_suite') && $schema->getTable('unit_test_suite')->hasColumn('folder_id')) {
            $this->addSql('ALTER TABLE unit_test_suite DROP FOREIGN KEY FK_UNIT_SUITE_FOLDER');
            $this->addSql('DROP INDEX IDX_UNIT_SUITE_FOLDER ON unit_test_suite');
            $this->addSql('ALTER TABLE unit_test_suite DROP folder_id');
        }
    }
}
