<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251121223043 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE test_scenario ADD base_url VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE unit_test_suite DROP FOREIGN KEY FK_UNIT_SUITE_FOLDER');
        $this->addSql('ALTER TABLE unit_test_suite ADD CONSTRAINT FK_1D4AD4ED162CB942 FOREIGN KEY (folder_id) REFERENCES scenario_folder (id)');
        $this->addSql('ALTER TABLE unit_test_suite RENAME INDEX idx_unit_suite_folder TO IDX_1D4AD4ED162CB942');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE unit_test_suite DROP FOREIGN KEY FK_1D4AD4ED162CB942');
        $this->addSql('ALTER TABLE unit_test_suite ADD CONSTRAINT FK_UNIT_SUITE_FOLDER FOREIGN KEY (folder_id) REFERENCES scenario_folder (id) ON UPDATE NO ACTION ON DELETE SET NULL');
        $this->addSql('ALTER TABLE unit_test_suite RENAME INDEX idx_1d4ad4ed162cb942 TO IDX_UNIT_SUITE_FOLDER');
        $this->addSql('ALTER TABLE test_scenario DROP base_url');
    }
}
