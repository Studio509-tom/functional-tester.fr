<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20251103UnitTestSuite extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create unit_test_suite table';
    }

    public function up(Schema $schema): void
    {
        if (!$schema->hasTable('unit_test_suite')) {
            $this->addSql('CREATE TABLE unit_test_suite (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(255) NOT NULL, tests_json LONGTEXT NOT NULL, created_at DATETIME NOT NULL COMMENT \'(DC2Type:datetime_immutable)\', PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        }
    }

    public function down(Schema $schema): void
    {
        if ($schema->hasTable('unit_test_suite')) {
            $this->addSql('DROP TABLE unit_test_suite');
        }
    }
}
